// package com.project.videoserver.processing;

// import org.bytedeco.javacv.*;
// import org.bytedeco.opencv.opencv_core.Mat;
// import org.springframework.stereotype.Service;

// import java.io.*;
// import java.nio.file.*;
// import java.util.concurrent.*;

// @Service
// public class VideoProcessor {
    
//     private final ExecutorService processingPool = 
//         Executors.newFixedThreadPool(4);
    
//     /**
//      * Process video chunks into a single file
//      */
//     public CompletableFuture<File> mergeChunks(
//         List<byte[]> chunks, 
//         String outputFormat
//     ) {
//         return CompletableFuture.supplyAsync(() -> {
//             try {
//                 // Create temp file
//                 Path tempFile = Files.createTempFile("video-", "." + outputFormat);
                
//                 // Merge all chunks
//                 try (FileOutputStream fos = new FileOutputStream(tempFile.toFile())) {
//                     for (byte[] chunk : chunks) {
//                         fos.write(chunk);
//                     }
//                 }
                
//                 // Optional: Re-encode for compression
//                 if (outputFormat.equals("mp4")) {
//                     return compressVideo(tempFile.toFile());
//                 }
                
//                 return tempFile.toFile();
                
//             } catch (Exception e) {
//                 throw new RuntimeException("Failed to merge chunks", e);
//             }
//         }, processingPool);
//     }
    
//     /**
//      * Compress video using FFmpeg (requires ffmpeg in Docker container)
//      */
//     private File compressVideo(File inputFile) throws IOException {
//         Path outputPath = Files.createTempFile("compressed-", ".mp4");
        
//         try {
//             FFmpegFrameGrabber grabber = new FFmpegFrameGrabber(inputFile);
//             FFmpegFrameRecorder recorder = new FFmpegFrameRecorder(
//                 outputPath.toFile(),
//                 grabber.getImageWidth(),
//                 grabber.getImageHeight(),
//                 grabber.getAudioChannels()
//             );
            
//             grabber.start();
//             recorder.start();
            
//             Frame frame;
//             while ((frame = grabber.grabFrame()) != null) {
//                 recorder.record(frame);
//             }
            
//             recorder.stop();
//             grabber.stop();
            
//             return outputPath.toFile();
            
//         } catch (Exception e) {
//             // Fallback: return original if compression fails
//             return inputFile;
//         }
//     }
    
//     /**
//      * Extract thumbnail from video
//      */
//     public byte[] generateThumbnail(File videoFile, int frameNumber) 
//         throws Exception {
        
//         try (FFmpegFrameGrabber grabber = new FFmpegFrameGrabber(videoFile)) {
//             grabber.start();
            
//             // Seek to frame
//             grabber.setFrameNumber(frameNumber);
            
//             // Grab frame
//             Frame frame = grabber.grabImage();
            
//             if (frame != null) {
//                 // Convert to JPEG
//                 Java2DFrameConverter converter = new Java2DFrameConverter();
//                 java.awt.image.BufferedImage image = converter.convert(frame);
                
//                 ByteArrayOutputStream baos = new ByteArrayOutputStream();
//                 javax.imageio.ImageIO.write(image, "jpg", baos);
                
//                 return baos.toByteArray();
//             }
            
//             grabber.stop();
//         }
        
//         return new byte[0];
//     }
// }