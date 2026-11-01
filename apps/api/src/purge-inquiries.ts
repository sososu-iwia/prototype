import "./config";
import { purgeExpiredInquiries } from "./inquiry-retention";
import { db } from "./db";
purgeExpiredInquiries()
  .then((count) => console.log(JSON.stringify({ purged: count })))
  .catch(() => {
    console.error("Inquiry retention failed");
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
