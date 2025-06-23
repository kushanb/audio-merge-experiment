"use client";

import { useState, useRef, useEffect } from "react";
import type { FFmpeg } from "@ffmpeg/ffmpeg";
import type { fetchFile } from "@ffmpeg/util";

export default function AudioMergerSimple() {
  const [speechFile, setSpeechFile] = useState<File | null>(null);
  const [musicFile, setMusicFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [status, setStatus] = useState("");
  const [outputUrl, setOutputUrl] = useState("");
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);

  // Load FFmpeg on component mount
  useEffect(() => {
    let ffmpegLoadAbort = new AbortController();

    const loadFFmpeg = async () => {
      try {
        setStatus("Loading FFmpeg...");

        // Use dynamic import to avoid SSR issues
        const FFmpegModule = await import("@ffmpeg/ffmpeg");
        const ffmpeg = new FFmpegModule.FFmpeg();
        ffmpegRef.current = ffmpeg;

        // Load FFmpeg from local files
        await ffmpeg.load({
          coreURL: "/ffmpeg/ffmpeg-core.js",
          wasmURL: "/ffmpeg/ffmpeg-core.wasm",
          workerURL: "/ffmpeg/ffmpeg-core.worker.js",
        });

        setFfmpegLoaded(true);
        setStatus("FFmpeg loaded successfully");
      } catch (error) {
        console.error("Error loading FFmpeg:", error);
        setErrorMessage(
          `Failed to load FFmpeg: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    };

    loadFFmpeg();

    return () => {
      ffmpegLoadAbort.abort();
    };
  }, []);

  const handleSpeechFileChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (event.target.files && event.target.files.length > 0) {
      setSpeechFile(event.target.files[0]);
    }
  };

  const handleMusicFileChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (event.target.files && event.target.files.length > 0) {
      setMusicFile(event.target.files[0]);
    }
  };

  const handleMergeClick = async () => {
    if (!speechFile || !musicFile) {
      setErrorMessage("Please select both speech and music files");
      return;
    }

    if (!ffmpegLoaded || !ffmpegRef.current) {
      setErrorMessage("FFmpeg is not loaded yet");
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage("");
      setOutputUrl("");

      const ffmpeg = ffmpegRef.current;

      // Write files to FFmpeg's virtual filesystem
      setStatus("Loading speech file...");
      const FFmpegUtil = await import("@ffmpeg/util");
      await ffmpeg.writeFile(
        "speech.mp3",
        await FFmpegUtil.fetchFile(speechFile)
      );

      setStatus("Loading music file...");
      await ffmpeg.writeFile(
        "music.mp3",
        await FFmpegUtil.fetchFile(musicFile)
      );

      // Merge audio files
      setStatus("Merging audio files...");
      await ffmpeg.exec([
        "-i",
        "speech.mp3",
        "-i",
        "music.mp3",
        "-filter_complex",
        "[0:a]volume=1.0[a1];[1:a]volume=0.4[a2];[a1][a2]amix=inputs=2:duration=longest",
        "-c:a",
        "libmp3lame",
        "-b:a",
        "192k",
        "output.mp3",
      ]);

      // Read the output file
      setStatus("Creating download file...");
      const data = await ffmpeg.readFile("output.mp3");

      // Create object URL for download
      const blob = new Blob([data], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);
      setOutputUrl(url);
      setStatus("Merge completed successfully!");
    } catch (error) {
      console.error("Error during audio merge:", error);
      setErrorMessage(
        `Error during audio merge: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      setStatus("Failed to merge audio files");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: "600px",
        margin: "0 auto",
        padding: "20px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h1>Simple Audio Merger</h1>

      <div style={{ marginBottom: "20px" }}>
        <h3>Status: {status}</h3>
        {errorMessage && (
          <div
            style={{
              padding: "10px",
              backgroundColor: "#ffeeee",
              color: "red",
              borderRadius: "5px",
              marginBottom: "10px",
            }}
          >
            <strong>Error:</strong> {errorMessage}
          </div>
        )}
      </div>

      <div style={{ marginBottom: "15px" }}>
        <label
          htmlFor="speech-file"
          style={{ display: "block", marginBottom: "5px" }}
        >
          Speech Audio:
        </label>
        <input
          id="speech-file"
          type="file"
          accept="audio/*"
          onChange={handleSpeechFileChange}
          disabled={isLoading}
        />
        {speechFile && <p>Selected: {speechFile.name}</p>}
      </div>

      <div style={{ marginBottom: "15px" }}>
        <label
          htmlFor="music-file"
          style={{ display: "block", marginBottom: "5px" }}
        >
          Background Music:
        </label>
        <input
          id="music-file"
          type="file"
          accept="audio/*"
          onChange={handleMusicFileChange}
          disabled={isLoading}
        />
        {musicFile && <p>Selected: {musicFile.name}</p>}
      </div>

      <button
        onClick={handleMergeClick}
        disabled={isLoading || !ffmpegLoaded || !speechFile || !musicFile}
        style={{
          padding: "10px 20px",
          backgroundColor:
            isLoading || !ffmpegLoaded || !speechFile || !musicFile
              ? "#cccccc"
              : "#4CAF50",
          color: "white",
          border: "none",
          borderRadius: "5px",
          cursor: isLoading || !ffmpegLoaded ? "not-allowed" : "pointer",
          marginBottom: "20px",
        }}
      >
        {isLoading ? "Processing..." : "Merge Audio Files"}
      </button>

      {outputUrl && (
        <div
          style={{
            marginTop: "20px",
            padding: "15px",
            backgroundColor: "#f0f9ff",
            borderRadius: "5px",
          }}
        >
          <h3>Your merged audio is ready!</h3>
          <audio controls style={{ width: "100%", marginBottom: "10px" }}>
            <source src={outputUrl} type="audio/mpeg" />
            Your browser does not support the audio element.
          </audio>
          <a
            href={outputUrl}
            download="merged-audio.mp3"
            style={{
              display: "inline-block",
              padding: "10px 20px",
              backgroundColor: "#2196F3",
              color: "white",
              textDecoration: "none",
              borderRadius: "5px",
            }}
          >
            Download Merged Audio
          </a>
        </div>
      )}
    </div>
  );
}
