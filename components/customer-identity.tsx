"use client";
import { useState } from "react";
import styles from "./customer-identity.module.css";
export function CustomerIdentity({ name, logoUrl, detail }: { name: string; logoUrl?: string; detail?: string }) {
  const [failedUrl, setFailedUrl] = useState<string>();
  return <div className={styles.identity}>
    <span className={styles.mark}>
      {logoUrl && failedUrl !== logoUrl ? (
        // External customer images have unknown dimensions.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt={`${name} logo`} onError={() => setFailedUrl(logoUrl)} />
      ) : <span aria-label={`${name} initials`}>{name.split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase()}</span>}
    </span>
    <div><h2>{name}</h2>{detail && <p>{detail}</p>}</div>
  </div>;
}
