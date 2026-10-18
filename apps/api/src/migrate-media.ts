import "./config";
import { db } from "./db";
import { migrateLocalMediaToS3 } from "./storage";
migrateLocalMediaToS3()
  .catch(() => {
    console.error(
      "Media migration failed; existing metadata and local files retained. Check S3 configuration and permissions.",
    );
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
