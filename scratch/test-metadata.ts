import { generateMetadata } from './src/app/page';

async function testMetadata() {
  console.log('--- 測試 ID: 1321 的 Metadata 生成 ---');
  const metadata = await generateMetadata({ 
    searchParams: { species: '1321' } 
  });
  
  console.log('標題:', metadata.title);
  console.log('描述:', metadata.description);
  console.log('OG 標題:', metadata.openGraph?.title);
  console.log('OG 圖片:', JSON.stringify(metadata.openGraph?.images));
  console.log('Twitter 圖片:', JSON.stringify(metadata.twitter?.images));
}

testMetadata().catch(console.error);
