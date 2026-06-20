"""ذخیره‌سازی S3-compatible برای فایل‌های ضبط‌شده + URL امضاشده برای پخش."""
import asyncio

import boto3

from src.shared.config.settings import get_settings


class S3Storage:
    def __init__(self):
        s = get_settings()
        self._bucket = s.s3_bucket
        self._client = boto3.client(
            "s3",
            endpoint_url=s.s3_endpoint or None,
            aws_access_key_id=s.s3_access_key,
            aws_secret_access_key=s.s3_secret_key,
            region_name=s.s3_region,
        )

    async def put(self, key: str, data: bytes, content_type: str = "audio/mpeg") -> str:
        await asyncio.to_thread(
            self._client.put_object,
            Bucket=self._bucket, Key=key, Body=data, ContentType=content_type,
        )
        return key

    async def presigned_url(self, key: str, expires: int = 600) -> str:
        return await asyncio.to_thread(
            self._client.generate_presigned_url,
            "get_object",
            Params={"Bucket": self._bucket, "Key": key},
            ExpiresIn=expires,
        )
