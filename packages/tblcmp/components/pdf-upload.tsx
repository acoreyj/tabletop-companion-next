"use client";

import { useState, useRef, useEffect } from "react";
import { Upload, FileText, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

interface FileData {
  id: string;
  name: string;
  size: number;
  r2Url?: string;
  hash: string;
}

interface PdfUploadProps {
  sessionId: string;
}

export function PdfUpload({ sessionId }: PdfUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [messages, setMessages] = useState<string[]>([]);
  const [files, setFiles] = useState<FileData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Get the RAG endpoint from environment variable or use default
  const ragEndpoint =
    process.env.NEXT_PUBLIC_RAG_ENDPOINT || "http://localhost:8787/api";

  // Fetch files on component mount
  useEffect(() => {
    fetchFiles();
  }, [sessionId]);

  // Function to fetch files for the current session
  const fetchFiles = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${ragEndpoint}/get-files/${sessionId}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setFiles(data.files || []);
    } catch (error) {
      console.error("Error fetching files:", error);
      toast({
        title: "Failed to fetch files",
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type !== "application/pdf") {
        toast({
          title: "Invalid file type",
          description: "Only PDF files are supported",
          variant: "destructive",
        });
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast({
        title: "No file selected",
        description: "Please select a PDF file to upload",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    setProgress(0);
    setMessages([]);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("sessionId", sessionId);

    try {
      const response = await fetch(`${ragEndpoint}/upload`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Response body is not readable");
      }

      let receivedLength = 0;
      const contentLength = parseInt(
        response.headers.get("Content-Length") || "0"
      );

      // Process the stream
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        // Update progress if content length is available
        if (contentLength) {
          receivedLength += value.length;
          setProgress(Math.round((receivedLength / contentLength) * 100));
        } else {
          // If content length is not available, show indeterminate progress
          setProgress(50);
        }

        // Process the chunk data
        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split("\n").filter((line) => line.trim());

        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.message) {
              setMessages((prev) => [...prev, data.message]);
            } else if (data.error) {
              setMessages((prev) => [...prev, `Error: ${data.error}`]);
              toast({
                title: "Upload Error",
                description: data.error,
                variant: "destructive",
              });
            }
          } catch (e) {
            // If it's not valid JSON, just add the line as a message
            setMessages((prev) => [...prev, line]);
          }
        }
      }

      toast({
        title: "Upload Complete",
        description: "File has been processed successfully",
      });

      // Fetch updated file list after successful upload
      fetchFiles();
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Upload Failed",
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      setProgress(100);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setFile(null);
    }
  };

  // Format file size to human-readable format
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="mt-6 border-t pt-4">
      <h2 className="mb-3 text-lg font-semibold">Upload Game Rules</h2>

      {/* File upload section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            onChange={handleFileChange}
            disabled={isUploading}
            className="flex-1"
          />
          <Button
            onClick={handleUpload}
            disabled={!file || isUploading}
            className="flex items-center gap-2"
          >
            <Upload className="h-4 w-4" />
            Upload
          </Button>
        </div>

        {isUploading && (
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <p className="text-sm text-muted-foreground">
              Uploading... {progress}%
            </p>
          </div>
        )}

        {messages.length > 0 && (
          <Alert>
            <FileText className="h-4 w-4" />
            <AlertTitle>Processing Updates</AlertTitle>
            <AlertDescription>
              <div className="mt-2 max-h-40 overflow-y-auto space-y-1 text-sm">
                {messages.map((message, index) => (
                  <p key={index}>{message}</p>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Uploaded files section */}
      <div className="mt-6">
        <h3 className="mb-2 text-md font-medium">Uploaded Files</h3>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading files...</p>
        ) : files.length === 0 ? (
          <p className="text-sm text-muted-foreground">No files uploaded yet</p>
        ) : (
          <div className="space-y-2">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between p-3 border rounded-md"
              >
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-500" />
                  <div>
                    <p className="text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
