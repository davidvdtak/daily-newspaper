import type { S3Event } from "aws-lambda";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { remarkable } from "rmapi-js";
import type { MetadataEntry } from "rmapi-js";

const s3 = new S3Client({});

async function bodyToBuffer(body: any): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of body) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function deviceToken() {
  const token = process.env.REMARKABLE_TOKEN;
  if (!token) throw new Error("REMARKABLE_TOKEN is required");
  return token;
}

function editionDate(name: string) {
  const m = name.match(/^(\d{4}-\d{2}-\d{2}) - Daily Newspaper$/);
  return m ? m[1] : null;
}

export const handler = async (event: S3Event) => {
  const record = event.Records?.[0];
  if (!record) throw new Error("Expected an S3 ObjectCreated event");

  const bucket = record.s3.bucket.name;
  const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
  if (!key.toLowerCase().endsWith(".pdf")) return { skipped: true, key };

  const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!object.Body) throw new Error("S3 object has no body");
  const pdf = await bodyToBuffer(object.Body);

  const token = deviceToken();
  const api = await remarkable(token);
  let items = await api.getEntriesMetadata();

  const folderName = process.env.REMARKABLE_FOLDER || "Daily Newspaper";
  let folder = items.find((x): x is MetadataEntry =>
    x.type === "CollectionType" && x.visibleName === folderName && (x.parent || "") === ""
  );

  if (!folder) {
    const folderRef = await api.putCollection(folderName);
    await api.create(folderRef, true);
    items = await api.getEntriesMetadata();
    folder = items.find((x): x is MetadataEntry => x.id === folderRef.documentId) ||
      items.find((x): x is MetadataEntry => x.type === "CollectionType" && x.visibleName === folderName);
  }
  if (!folder) throw new Error("Could not create/find Daily Newspaper folder");

  const visibleName = key.split("/").pop()!.replace(/\.pdf$/i, "");
  const existing = items.find((x) =>
    x.type === "DocumentType" && x.visibleName === visibleName && x.parent === folder.id
  );

  if (!existing) {
    const uploaded = await api.putPdf(visibleName, pdf, { parent: folder.id });
    await api.create(uploaded, true);
  }

  // Refresh, sort editions newest-first, and keep exactly the newest N.
  items = await api.getEntriesMetadata();
  const keep = Number(process.env.KEEP_EDITIONS || "5");
  const editions = items
    .filter((x) => x.type === "DocumentType" && x.parent === folder.id && editionDate(x.visibleName))
    .sort((a, b) => editionDate(b.visibleName)!.localeCompare(editionDate(a.visibleName)!));

  const old = editions.slice(keep);
  if (old.length) await Promise.all(old.map((x) => api.move(x.id, "trash", true)));

  return {
    statusCode: 200,
    uploaded: existing ? false : visibleName,
    folder: folderName,
    kept: editions.length - old.length,
    deleted: old.map((x) => x.visibleName)
  };
};
