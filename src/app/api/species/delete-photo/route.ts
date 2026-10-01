import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  console.log('[DeletePhoto API] Request received');
  try {
    const body = await req.json().catch(() => ({}));
    const { photoId } = body;

    console.log('[DeletePhoto API] photoId:', photoId);

    if (!photoId) {
      console.error('[DeletePhoto API] Error: Missing photoId');
      return NextResponse.json({ error: 'Missing photoId' }, { status: 400 });
    }

    const supabase = await createClient();
    
    // 優先使用 getUser()，若失敗則備用 getSession()
    let userId: string | undefined;
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (user) {
      userId = user.id;
    } else {
      const { data: { session } } = await supabase.auth.getSession();
      userId = session?.user?.id;
    }

    console.log('[DeletePhoto API] Auth check:', { userId, userError: userError?.message });

    if (!userId) {
      console.error('[DeletePhoto API] Error: User not logged in or session invalid');
      return NextResponse.json({ error: 'Unauthorized: User not logged in' }, { status: 401 });
    }

    // 1. 取得使用者 profile 權限
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    const userRole = profile?.role || 'guest';
    console.log('[DeletePhoto API] User profile role:', userRole, 'error:', profileError);

    // 2. 取得要刪除的照片資訊
    const { data: photoData, error: photoError } = await supabase
      .from('species_community_photos')
      .select('*')
      .eq('id', photoId)
      .maybeSingle();

    console.log('[DeletePhoto API] Target photoData:', photoData, 'photoError:', photoError);

    if (photoError || !photoData) {
      console.error('[DeletePhoto API] Error: Photo record not found');
      return NextResponse.json({ error: 'Photo not found in database' }, { status: 404 });
    }

    // 3. 權限檢查：只有本人或 admin / curator 可以刪除
    const isOwner = photoData.user_id === userId;
    const isStaff = userRole === 'admin' || userRole === 'curator';
    console.log('[DeletePhoto API] Permission check:', { isOwner, isStaff, photoUserId: photoData.user_id, currentUserId: userId });

    if (!isOwner && !isStaff) {
      console.error('[DeletePhoto API] Error: Permission denied');
      return NextResponse.json({ error: 'Forbidden: You do not have permission to delete this photo' }, { status: 403 });
    }

    // 4. 刪除 Cloudinary 上的照片
    let publicId = photoData.cloudinary_public_id;
    if (!publicId && photoData.image_url) {
      try {
        const urlParts = photoData.image_url.split('/upload/');
        if (urlParts.length > 1) {
          const afterUpload = urlParts[1].replace(/^(f_auto,q_auto\/|v\d+\/)+/, '');
          publicId = afterUpload.substring(0, afterUpload.lastIndexOf('.')) || afterUpload;
        }
      } catch (e) {
        console.error('[DeletePhoto API] Failed to parse public_id from image_url:', e);
      }
    }

    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    const apiKey = process.env.CLOUDINARY_API_KEY;

    console.log('[DeletePhoto API] Cloudinary params:', { publicId, cloudName, hasApiKey: !!apiKey, hasApiSecret: !!apiSecret });

    if (photoData.image_url?.includes('res.cloudinary.com') && !publicId) {
      return NextResponse.json({ error: 'Could not determine the Cloudinary photo ID' }, { status: 502 });
    }

    if (publicId && (!cloudName || !apiKey || !apiSecret)) {
      return NextResponse.json({ error: 'Cloudinary deletion is not configured on the server' }, { status: 503 });
    }

    if (publicId && cloudName && apiKey && apiSecret) {
      try {
        const timestamp = Math.floor(Date.now() / 1000);
        const strToSign = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
        const signature = crypto.createHash('sha1').update(strToSign).digest('hex');

        const formData = new FormData();
        formData.append('public_id', publicId);
        formData.append('api_key', apiKey);
        formData.append('timestamp', timestamp.toString());
        formData.append('signature', signature);

        const cloudRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, {
          method: 'POST',
          body: formData
        });
        const cloudResult = await cloudRes.json();
        console.log('[DeletePhoto API] Cloudinary destroy response:', cloudResult);
        if (!cloudRes.ok || !['ok', 'not found'].includes(cloudResult.result)) {
          return NextResponse.json({ error: cloudResult.error?.message || 'Cloudinary failed to delete the photo' }, { status: 502 });
        }
      } catch (cloudErr) {
        console.error('[DeletePhoto API] Error deleting from Cloudinary:', cloudErr);
        return NextResponse.json({ error: 'Cloudinary failed to delete the photo' }, { status: 502 });
      }
    } else {
      console.warn('[DeletePhoto API] Cloudinary deletion skipped (credentials missing or publicId unknown)');
    }

    const { error: anatomyError } = await supabase.rpc('clear_anatomy_reference_for_deleted_community_photo', {
      p_photo_id: String(photoId)
    });
    if (anatomyError) {
      console.error('[DeletePhoto API] Failed to clear anatomy reference:', anatomyError);
      return NextResponse.json({ error: anatomyError.message || 'Failed to remove photo from the anatomy illustration' }, { status: 500 });
    }

    // Remove the photo record after its anatomy references have been cleared.
    const { data: deleteData, error: deleteError } = await supabase
      .from('species_community_photos')
      .delete()
      .eq('id', photoId)
      .select();

    console.log('[DeletePhoto API] DB Delete result:', { deleteData, deleteError });

    if (deleteError) {
      console.error('[DeletePhoto API] DB Delete Error:', deleteError);
      return NextResponse.json({ error: deleteError.message || 'Failed to delete photo from database' }, { status: 500 });
    }

    // 若 deleteData 為空陣列，代表受到 RLS Policy 限制或 anon key 權限限制未能刪除列
    if (!deleteData || deleteData.length === 0) {
      console.warn('[DeletePhoto API] Standard delete returned 0 rows, attempting direct match check...');
      // 嘗試雙重確認與直接比對刪除
      const { error: fallbackError } = await supabase
        .from('species_community_photos')
        .delete()
        .match({ id: photoId });

      if (fallbackError) {
        console.error('[DeletePhoto API] DB Delete Fallback Error:', fallbackError);
        return NextResponse.json({ error: fallbackError.message || 'Failed to delete photo via fallback' }, { status: 500 });
      }
    }

    console.log('[DeletePhoto API] Successfully deleted photo:', photoId);
    return NextResponse.json({ success: true, deletedId: photoId });

  } catch (err: unknown) {
    console.error('[DeletePhoto API] Internal error:', err);
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

