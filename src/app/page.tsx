"use client";

import { useState, useRef, FormEvent, useEffect } from "react";
import Image from "next/image";
import type { FFmpeg } from "@ffmpeg/ffmpeg";
import type { fetchFile } from "@ffmpeg/util";

export default function Home() {
  const [speechFile, setSpeechFile] = useState<File | null>(null);
  const [musicFile, setMusicFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const ffmpegRef = useRef<FFmpeg | null>(null);

  // Initialize FFmpeg
  useEffect(() => {
    let ffmpegLoadAbort = new AbortController();

    const load = async () => {
      try {
        setLoadingMessage("Loading audio processing capabilities...");

        // Use dynamic import to avoid SSR issues
        const FFmpegModule = await import("@ffmpeg/ffmpeg");
        const ffmpeg = new FFmpegModule.FFmpeg();
        ffmpegRef.current = ffmpeg;

        // Using local files from the public directory
        await ffmpeg.load({
          coreURL: "/ffmpeg/ffmpeg-core.js",
          wasmURL: "/ffmpeg/ffmpeg-core.wasm",
          workerURL: "/ffmpeg/ffmpeg-core.worker.js",
        });

        setFfmpegLoaded(true);
        setLoadingMessage("");
      } catch (error) {
        console.error("Error loading FFmpeg:", error);
        const errorMessage =
          error instanceof Error
            ? `${error.message}\n${error.stack}`
            : "Unknown error";
        setError(
          `Failed to load audio processing capabilities: ${errorMessage}. Please refresh and try again.`
        );
      }
    };

    load();

    return () => {
      ffmpegLoadAbort.abort();
    };
  }, []);

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    fileType: "speech" | "music"
  ) => {
    if (e.target.files && e.target.files.length > 0) {
      if (fileType === "speech") {
        setSpeechFile(e.target.files[0]);
      } else {
        setMusicFile(e.target.files[0]);
      }
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Reset previous states
    setError(null);
    setDownloadUrl(null);

    // Validate files
    if (!speechFile || !musicFile) {
      setError(
        "Please select both a speech audio file and a music audio file."
      );
      return;
    }

    // Check file types
    const validAudioTypes = [
      "audio/mp3",
      "audio/mpeg",
      "audio/wav",
      "audio/ogg",
    ];
    if (
      !validAudioTypes.includes(speechFile.type) ||
      !validAudioTypes.includes(musicFile.type)
    ) {
      setError("Please select valid audio files (MP3, WAV, or OGG).");
      return;
    }

    // Check if FFmpeg is loaded
    if (!ffmpegRef.current || !ffmpegLoaded) {
      setError(
        "Audio processing capabilities are not loaded yet. Please wait or refresh the page."
      );
      return;
    }

    setIsLoading(true);
    setLoadingMessage("Processing audio files...");

    try {
      const ffmpeg = ffmpegRef.current;

      // Write files to FFmpeg's virtual file system
      setLoadingMessage("Loading speech audio...");
      const FFmpegUtil = await import("@ffmpeg/util");
      await ffmpeg.writeFile(
        "speech.mp3",
        await FFmpegUtil.fetchFile(speechFile)
      );

      setLoadingMessage("Loading music audio...");
      await ffmpeg.writeFile(
        "music.mp3",
        await FFmpegUtil.fetchFile(musicFile)
      );

      // Run FFmpeg command to merge audio files
      setLoadingMessage("Merging audio files...");
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
      setLoadingMessage("Preparing download...");
      const data = await ffmpeg.readFile("output.mp3");

      // Create a blob URL for the output file
      const blob = new Blob([data], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);

      // Reset form
      if (formRef.current) {
        formRef.current.reset();
      }
      setSpeechFile(null);
      setMusicFile(null);
    } catch (err) {
      console.error("Error merging audio:", err);
      const errorMessage =
        err instanceof Error ? `${err.message}\n${err.stack}` : "Unknown error";
      setError(`Error merging audio: ${errorMessage}`);
    } finally {
      setIsLoading(false);
      setLoadingMessage("");
    }
  };

  return (
    <div className="grid grid-rows-[auto_1fr_auto] min-h-screen p-8 pb-20 gap-8 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <header className="flex flex-col gap-4 items-center">
        <Image
          className="dark:invert"
          src="/next.svg"
          alt="Next.js logo"
          width={180}
          height={38}
          priority
        />
        <h1 className="text-2xl font-bold text-center mt-4">Audio Merger</h1>
        <p className="text-center text-gray-600 dark:text-gray-400 max-w-xl">
          Upload a speech audio file and a music audio file to merge them. The
          speech will be at 100% volume and the music will be at 40% volume.
        </p>
        <div className="flex gap-3">
          <a href="/simple" className="text-blue-600 hover:underline mt-2">
            Try simplified version
          </a>
          <a
            href="/standalone.html"
            className="text-blue-600 hover:underline mt-2"
          >
            Try standalone HTML version
          </a>
        </div>
      </header>

      <main className="flex flex-col items-center justify-start w-full max-w-2xl mx-auto">
        {loadingMessage && !isLoading && (
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-blue-700 dark:text-blue-400">
            <p>{loadingMessage}</p>
          </div>
        )}

        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="w-full space-y-6 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700"
        >
          <div className="space-y-4">
            <div>
              <label
                htmlFor="speech-file"
                className="block text-sm font-medium mb-1"
              >
                Speech Audio File
              </label>
              <input
                id="speech-file"
                type="file"
                accept="audio/*"
                onChange={(e) => handleFileChange(e, "speech")}
                className="block w-full text-sm file:mr-4 file:py-2 file:px-4
                  file:rounded-full file:border-0 file:text-sm file:font-semibold
                  file:bg-black file:text-white
                  hover:file:bg-gray-800 cursor-pointer
                  dark:file:bg-gray-700 dark:hover:file:bg-gray-600
                  dark:text-gray-300 p-2 rounded-lg border border-gray-300 dark:border-gray-600"
                required
              />
              {speechFile && (
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Selected: {speechFile.name} (
                  {(speechFile.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="music-file"
                className="block text-sm font-medium mb-1"
              >
                Background Music File
              </label>
              <input
                id="music-file"
                type="file"
                accept="audio/*"
                onChange={(e) => handleFileChange(e, "music")}
                className="block w-full text-sm file:mr-4 file:py-2 file:px-4
                  file:rounded-full file:border-0 file:text-sm file:font-semibold
                  file:bg-black file:text-white
                  hover:file:bg-gray-800 cursor-pointer
                  dark:file:bg-gray-700 dark:hover:file:bg-gray-600
                  dark:text-gray-300 p-2 rounded-lg border border-gray-300 dark:border-gray-600"
                required
              />
              {musicFile && (
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Selected: {musicFile.name} (
                  {(musicFile.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || !ffmpegLoaded}
            className="w-full bg-black text-white py-3 px-4 rounded-full font-medium hover:bg-gray-800 
              disabled:opacity-50 disabled:cursor-not-allowed transition
              dark:bg-gray-700 dark:hover:bg-gray-600 flex items-center justify-center"
          >
            {isLoading ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                {loadingMessage || "Processing..."}
              </>
            ) : !ffmpegLoaded ? (
              "Loading..."
            ) : (
              "Merge Audio Files"
            )}
          </button>
        </form>

        {error && (
          <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
            <p className="font-medium">Error:</p>
            <pre className="whitespace-pre-wrap text-sm overflow-auto max-h-60">
              {error}
            </pre>
          </div>
        )}

        {downloadUrl && (
          <div className="mt-6 p-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-center w-full">
            <p className="text-green-700 dark:text-green-400 font-medium mb-4">
              Audio files merged successfully!
            </p>

            <audio controls className="w-full mb-4">
              <source src={downloadUrl} type="audio/mpeg" />
              Your browser does not support the audio element.
            </audio>

            <a
              href={downloadUrl}
              download="merged-audio.mp3"
              className="inline-flex items-center justify-center bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-full font-medium transition dark:bg-green-700 dark:hover:bg-green-600"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mr-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              Download Merged Audio
            </a>
          </div>
        )}
      </main>

      <footer className="text-center text-sm text-gray-500 dark:text-gray-400 pt-8">
        <p>Built with Next.js and FFmpeg WebAssembly</p>
      </footer>
    </div>
  );
}
