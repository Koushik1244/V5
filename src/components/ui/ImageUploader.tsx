// src\components\ui\ImageUploader.tsx

"use client";

import { useRef, useState } from "react";
import axios from "axios";

type Props = {
    onUpload: (url: string) => void;
    onUploadingChange?: (uploading: boolean) => void;
    disabled?: boolean;
};

export default function ImageUploader({ onUpload, onUploadingChange, disabled = false }: Props) {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState("");

    const uploadFile = async (file: File) => {
        if (disabled || uploading) return;
        const formData = new FormData();
        formData.append("file", file);

        try {
            setUploading(true);
            setError("");
            onUploadingChange?.(true);

            const res = await axios.post("/api/upload", formData);
            const url = res.data.url;

            setPreview(url);
            onUpload(url);
        } catch {
            setError("Photo upload failed. Choose the file again to retry.");
        } finally {
            setUploading(false);
            onUploadingChange?.(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (file) uploadFile(file);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file) uploadFile(file);
    };

    return (
        <div>
            <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className="
          w-full h-40
          border-2 border-dashed border-primary/30
          rounded-lg
          flex items-center justify-center
          cursor-pointer
          bg-white/50 dark:bg-neutralDark
          hover:border-primary/60
          transition
          relative overflow-hidden
          "
            >
                <input
                    ref={inputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleChange}
                />
                <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    disabled={disabled || uploading}
                    className="absolute inset-0 z-10 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-primary"
                    aria-label={preview ? "Replace photo" : "Choose photo"}
                />

                {uploading ? (
                    <p role="status" className="text-primary font-medium">Uploading photo…</p>
                ) : preview ? (
                    <img
                        src={preview}
                        alt="Selected photo"
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="text-center text-primary/70">
                        <p className="text-sm">Choose or drop a photo</p>
                    </div>
                )}
            </div>
            {error && <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-300">{error}</p>}
        </div>
    );
}
