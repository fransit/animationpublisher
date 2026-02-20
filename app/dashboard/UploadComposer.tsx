"use client";

import { useMemo, useState } from "react";

type Creator = { key: string; label: string };
type UploadState = "queued" | "uploading" | "done" | "processing" | "error";

type UploadItem = {
  id: string;
  file: File;
  progress: number;
  state: UploadState;
  message?: string;
};

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function stateLabel(state: UploadState) {
  if (state === "done") return "Done";
  if (state === "processing") return "Processing";
  if (state === "uploading") return "Uploading";
  if (state === "error") return "Failed";
  return "Queued";
}

export default function UploadComposer(props: {
  creators: Creator[];
  defaultCreatorKey: string;
}) {
  const [creatorKey, setCreatorKey] = useState(props.defaultCreatorKey || "");
  const [creatorOverride, setCreatorOverride] = useState("");
  const [assetType, setAssetType] = useState<"MODEL" | "ANIMATION" | "AUDIO">("MODEL");
  const [assetNamePrefix, setAssetNamePrefix] = useState("");
  const [items, setItems] = useState<UploadItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const canSubmit = useMemo(() => {
    return (creatorKey || creatorOverride.trim()) && items.some((x) => x.state === "queued" || x.state === "error");
  }, [creatorKey, creatorOverride, items]);

  function pushFiles(files: FileList | File[]) {
    const next = Array.from(files).filter((f) => f.size > 0);
    if (!next.length) return;
    setItems((prev) => [
      ...prev,
      ...next.map((file) => ({
        id: uid(),
        file,
        progress: 0,
        state: "queued" as const,
      })),
    ]);
  }

  function updateItem(id: string, patch: Partial<UploadItem>) {
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((x) => x.id !== id));
  }

  async function uploadOne(item: UploadItem) {
    const finalCreator = creatorOverride.trim() || creatorKey;
    if (!finalCreator) {
      setFormError("Creator is required. Choose one from dropdown or set fallback like GROUP:123456.");
      return;
    }

    updateItem(item.id, { state: "uploading", progress: 0, message: undefined });

    const formData = new FormData();
    formData.set("creatorKey", creatorKey);
    formData.set("creatorIdOverride", creatorOverride.trim());
    formData.set("assetType", assetType);
    formData.set("assetNamePrefix", assetNamePrefix);
    formData.set("responseMode", "json");
    formData.append("files", item.file, item.file.name);

    await new Promise<void>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/upload");

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const p = Math.max(1, Math.min(99, Math.round((event.loaded / event.total) * 100)));
          updateItem(item.id, { progress: p });
        }
      };

      xhr.onload = () => {
        try {
          let payload: any = {};
          try {
            payload = xhr.responseText ? JSON.parse(xhr.responseText) : {};
          } catch {
            payload = { error: xhr.responseText || "Upload failed" };
          }
          const result = payload?.results?.[0];
          if (xhr.status >= 200 && xhr.status < 300 && result) {
            const status = String(result.status || "");
            if (status === "DONE") {
              updateItem(item.id, { state: "done", progress: 100, message: result.assetId ? `AssetId: ${result.assetId}` : "Published" });
            } else if (status === "PROCESSING") {
              updateItem(item.id, { state: "processing", progress: 100, message: "Still processing on Roblox..." });
            } else {
              updateItem(item.id, { state: "error", progress: 100, message: result.error || "Upload failed" });
            }
          } else {
            updateItem(item.id, { state: "error", progress: 100, message: payload?.error || `Upload failed (${xhr.status})` });
          }
        } catch {
          updateItem(item.id, { state: "error", progress: 100, message: "Invalid server response" });
        }
        resolve();
      };

      xhr.onerror = () => {
        updateItem(item.id, { state: "error", progress: 100, message: "Network error" });
        resolve();
      };

      xhr.send(formData);
    });
  }

  async function uploadQueued() {
    setFormError("");
    const finalCreator = creatorOverride.trim() || creatorKey;
    if (!finalCreator) {
      setFormError("Creator is required. Choose one from dropdown or set fallback like GROUP:123456.");
      return;
    }

    const queue = items.filter((x) => x.state === "queued" || x.state === "error");
    if (!queue.length) return;

    setSubmitting(true);
    for (const item of queue) {
      // Sequential uploads keep progress/status easy to follow and predictable.
      await uploadOne(item);
    }
    setSubmitting(false);
  }

  return (
    <div className="grid">
      <label>
        Creator
        <select value={creatorKey} onChange={(e) => setCreatorKey(e.target.value)}>
          <option value="">Select creator...</option>
          {props.creators.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        Creator fallback (optional)
        <input
          value={creatorOverride}
          onChange={(e) => setCreatorOverride(e.target.value)}
          placeholder="USER:123456 or GROUP:123456"
        />
      </label>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label>
          Asset type
          <select value={assetType} onChange={(e) => setAssetType(e.target.value as "MODEL" | "ANIMATION" | "AUDIO")}>
            <option value="MODEL">Model (.rbxm)</option>
            <option value="ANIMATION">Animation</option>
            <option value="AUDIO">Sound</option>
          </select>
        </label>

        <label>
          Name prefix (optional)
          <input value={assetNamePrefix} onChange={(e) => setAssetNamePrefix(e.target.value)} placeholder="Combat Pack - " />
        </label>
      </div>

      <div
        className={`dropzone ${dragOver ? "active" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files?.length) pushFiles(e.dataTransfer.files);
        }}
      >
        <b>Drag and drop files here</b>
        <span className="muted">or pick from your device</span>
        <input
          type="file"
          multiple
          onChange={(e) => {
            if (e.target.files) pushFiles(e.target.files);
          }}
        />
      </div>

      {formError ? <div className="error-box">{formError}</div> : null}

      <div className="uploader-list">
        {items.map((item) => (
          <div key={item.id} className="upload-row">
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.file.name}</div>
              <div className="muted" style={{ fontSize: 12 }}>
                {(item.file.size / 1024 / 1024).toFixed(2)} MB
              </div>
              <div className="progress">
                <div style={{ width: `${item.progress}%` }} />
              </div>
              {item.message ? (
                <div className="muted" style={{ fontSize: 12 }}>
                  {item.message}
                </div>
              ) : null}
            </div>
            <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
              <span className={`pill ${item.state === "done" ? "ok" : item.state === "error" ? "err" : "warn"}`}>{stateLabel(item.state)}</span>
              <div style={{ display: "flex", gap: 6 }}>
                {item.state === "error" ? (
                  <button className="secondary" type="button" onClick={() => uploadOne(item)}>
                    Retry
                  </button>
                ) : null}
                <button className="secondary" type="button" onClick={() => removeItem(item.id)}>
                  Remove
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button type="button" onClick={uploadQueued} disabled={!canSubmit || submitting}>
        {submitting ? "Uploading..." : "Upload Selected Files"}
      </button>
    </div>
  );
}
