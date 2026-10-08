import argparse
import csv
import os
import re
import shutil
import tempfile
from pathlib import Path
from urllib.error import URLError
from urllib.parse import unquote, urlparse
from urllib.request import Request, urlopen


def download_wav_files(csv_path: Path, output_dir: Path) -> int:
    output_dir.mkdir(parents=True, exist_ok=True)
    downloaded = 0
    skipped = 0
    failures = 0

    with csv_path.open("r", encoding="utf-8-sig", newline="") as csv_file:
        reader = csv.DictReader(csv_file)
        if not reader.fieldnames or "sound_url" not in reader.fieldnames:
            raise ValueError(f'{csv_path} 找不到必要的 "sound_url" 欄位。')

        for row_number, row in enumerate(reader, start=2):
            sound_url = (row.get("sound_url") or "").strip()
            parsed_url = urlparse(sound_url)
            if not sound_url or Path(parsed_url.path).suffix.lower() != ".wav":
                skipped += 1
                continue
            if parsed_url.scheme not in {"http", "https"} or not parsed_url.netloc:
                print(f"第 {row_number} 列 URL 無效：{sound_url}")
                failures += 1
                continue

            observation_id = (row.get("id") or "").strip()
            if observation_id:
                file_stem = re.sub(r"[^A-Za-z0-9_-]+", "_", observation_id).strip("_")
            else:
                file_stem = re.sub(
                    r"[^A-Za-z0-9_-]+",
                    "_",
                    Path(unquote(parsed_url.path)).stem,
                ).strip("_")
            destination = output_dir / f"{file_stem or f'row_{row_number}'}.wav"

            if destination.is_file():
                skipped += 1
                continue

            temporary_path = None
            try:
                request = Request(sound_url, headers={"User-Agent": "hkbiodiversity-audio-downloader/1.0"})
                with urlopen(request, timeout=30) as response:
                    with tempfile.NamedTemporaryFile(
                        mode="wb",
                        dir=output_dir,
                        suffix=".part",
                        delete=False,
                    ) as temporary_file:
                        temporary_path = Path(temporary_file.name)
                        shutil.copyfileobj(response, temporary_file)
                os.replace(temporary_path, destination)
                downloaded += 1
                print(f"已下載：{destination.name}")
            except (OSError, URLError) as error:
                failures += 1
                print(f"下載失敗（第 {row_number} 列）：{sound_url}；原因：{error}")
            finally:
                if temporary_path and temporary_path.exists():
                    temporary_path.unlink()

    print(f"完成：下載 {downloaded} 個，略過 {skipped} 個，失敗 {failures} 個。")
    return failures


def main() -> int:
    parser = argparse.ArgumentParser(
        description="從 CSV 的 sound_url 欄位下載 WAV 音檔。"
    )
    parser.add_argument("csv_file", type=Path, help="CSV 檔案路徑")
    parser.add_argument(
        "-o",
        "--output-dir",
        type=Path,
        default=Path("wav_downloads"),
        help="音檔輸出資料夾（預設：wav_downloads）",
    )
    args = parser.parse_args()

    if not args.csv_file.is_file():
        parser.error(f"找不到 CSV 檔案：{args.csv_file}")

    try:
        return 1 if download_wav_files(args.csv_file, args.output_dir) else 0
    except (OSError, ValueError) as error:
        parser.error(str(error))


if __name__ == "__main__":
    raise SystemExit(main())
