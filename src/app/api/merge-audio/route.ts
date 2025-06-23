import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import * as path from "path";
import * as os from "os";
import { randomUUID } from "crypto";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";

// Define interface for file information
interface FileInfo {
  filepath: string;
  filename: string;
  mimetype: string;
}

// Helper function to save form data files
async function saveFormFile(
  formData: FormData,
  fieldName: string
): Promise<FileInfo | null> {
  const file = formData.get(fieldName) as File | null;

  if (!file) {
    return null;
  }

  // Create a temporary directory
  const tmpDir = path.join(process.cwd(), "tmp");
  await fs.mkdir(tmpDir, { recursive: true });

  // Create a unique filename
  const buffer = await file.arrayBuffer();
  const filename = `${randomUUID()}-${file.name}`;
  const filepath = path.join(tmpDir, filename);

  // Write the file to disk
  await fs.writeFile(filepath, Buffer.from(buffer));

  return {
    filepath,
    filename: file.name,
    mimetype: file.type,
  };
}

// Helper function to merge audio files using ffmpeg.wasm
const mergeAudioFiles = async (
  speechPath: string,
  musicPath: string,
  outputPath: string
): Promise<void> => {
  try {
    // Read input files
    const speechData = await fs.readFile(speechPath);
    const musicData = await fs.readFile(musicPath);

    // Create a new FFmpeg instance
    const ffmpeg = new FFmpeg();

    // Load the FFmpeg core
    await ffmpeg.load();

    // Write input files to memory
    await ffmpeg.writeFile("speech.mp3", speechData);
    await ffmpeg.writeFile("music.mp3", musicData);

    // Execute FFmpeg command to mix audio
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
    const outputData = await ffmpeg.readFile("output.mp3");

    // Write the output file to disk
    await fs.writeFile(outputPath, outputData);

    // Terminate the FFmpeg instance
    ffmpeg.terminate();
  } catch (error) {
    console.error("Error in mergeAudioFiles:", error);
    throw error;
  }
};

// Helper function to clean up temporary files
const cleanupFiles = async (filePaths: string[]): Promise<void> => {
  for (const filePath of filePaths) {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      console.error(`Error deleting file ${filePath}:`, error);
    }
  }
};

export async function POST(req: NextRequest) {
  try {
    // Create the tmp directory if it doesn't exist
    const tmpDir = path.join(process.cwd(), "tmp");
    try {
      await fs.mkdir(tmpDir, { recursive: true });
    } catch (err) {
      // Directory may already exist, that's fine
    }

    // Parse the multipart form data
    const formData = await req.formData();

    // Save the uploaded files
    const speechFile = await saveFormFile(formData, "speech");
    const musicFile = await saveFormFile(formData, "music");

    // Validate files
    if (!speechFile || !musicFile) {
      return NextResponse.json(
        { error: "Both speech and music files are required" },
        { status: 400 }
      );
    }

    // Create output file path
    const outputFileName = `merged-${Date.now()}.mp3`;
    const outputPath = path.join(tmpDir, outputFileName);

    // Merge the audio files
    await mergeAudioFiles(speechFile.filepath, musicFile.filepath, outputPath);

    // Read the merged file
    const fileContent = await fs.readFile(outputPath);

    // Clean up temporary files
    const filesToCleanup = [
      speechFile.filepath,
      musicFile.filepath,
      outputPath,
    ];
    cleanupFiles(filesToCleanup);

    // Return the merged audio file
    return new NextResponse(fileContent, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Disposition": `attachment; filename="${outputFileName}"`,
      },
    });
  } catch (error) {
    console.error("Error processing audio:", error);
    return NextResponse.json(
      { error: "Error processing audio files" },
      { status: 500 }
    );
  }
}
