// package com.project.videoserver.storage;

// import io.minio.*;
// import io.minio.errors.*;
// import io.minio.messages.Item;
// import org.springframework.stereotype.Service;

// import java.io.ByteArrayInputStream;
// import java.io.InputStream;
// import java.security.InvalidKeyException;
// import java.security.NoSuchAlgorithmException;
// import java.util.ArrayList;
// import java.util.List;
// import java.util.concurrent.CompletableFuture;

// @Service
// public class MinioService {
    
//     private final MinioClient minioClient;
//     private final String bucketName = "video-storage";
    
//     public MinioService() throws Exception {
//         this.minioClient = MinioClient.builder()
//             .endpoint("http://minio:9000")
//             .credentials("minioadmin", "minioadmin")
//             .build();
        
//         initializeBucket();
//     }
    
//     private void initializeBucket() throws Exception {
//         boolean exists = minioClient.bucketExists(
//             BucketExistsArgs.builder().bucket(bucketName).build()
//         );
        
//         if (!exists) {
//             minioClient.makeBucket(
//                 MakeBucketArgs.builder().bucket(bucketName).build()
//             );
            
//             // Set bucket policy for public read (if needed)
//             String policy = """
//                 {
//                     "Version": "2012-10-17",
//                     "Statement": [
//                         {
//                             "Effect": "Allow",
//                             "Principal": "*",
//                             "Action": ["s3:GetObject"],
//                             "Resource": ["arn:aws:s3:::%s/*"]
//                         }
//                     ]
//                 }
//                 """.formatted(bucketName);
            
//             minioClient.setBucketPolicy(
//                 SetBucketPolicyArgs.builder()
//                     .bucket(bucketName)
//                     .config(policy)
//                     .build()
//             );
//         }
//     }
    
//     /**
//      * Upload video chunk asynchronously
//      */
//     public CompletableFuture<String> uploadChunk(
//         String sessionId, 
//         int chunkIndex, 
//         byte[] chunkData
//     ) {
//         return CompletableFuture.supplyAsync(() -> {
//             try {
//                 String objectName = String.format(
//                     "%s/chunk-%06d.bin", 
//                     sessionId, 
//                     chunkIndex
//                 );
                
//                 try (InputStream stream = new ByteArrayInputStream(chunkData)) {
//                     minioClient.putObject(
//                         PutObjectArgs.builder()
//                             .bucket(bucketName)
//                             .object(objectName)
//                             .stream(stream, chunkData.length, -1)
//                             .contentType("application/octet-stream")
//                             .build()
//                     );
//                 }
                
//                 return objectName;
                
//             } catch (Exception e) {
//                 throw new RuntimeException("Failed to upload chunk", e);
//             }
//         });
//     }
    
//     /**
//      * Multipart upload for large videos
//      */
//     public String uploadVideoMultipart(
//         String videoId, 
//         InputStream videoStream, 
//         long fileSize,
//         String contentType
//     ) throws Exception {
        
//         String objectName = "videos/" + videoId + ".mp4";
        
//         // Create multipart upload
//         String uploadId = minioClient.createMultipartUpload(
//             bucketName, 
//             null, 
//             objectName, 
//             null, 
//             null
//         ).result().uploadId();
        
//         // Upload parts (chunks of 5MB)
//         int partNumber = 1;
//         List<Part> parts = new ArrayList<>();
//         byte[] buffer = new byte[5 * 1024 * 1024]; // 5MB chunks
//         int bytesRead;
        
//         while ((bytesRead = videoStream.read(buffer)) != -1) {
//             try (ByteArrayInputStream chunkStream = 
//                  new ByteArrayInputStream(buffer, 0, bytesRead)) {
                
//                 UploadPartResponse response = minioClient.uploadPart(
//                     bucketName,
//                     null,
//                     objectName,
//                     chunkStream,
//                     bytesRead,
//                     uploadId,
//                     partNumber,
//                     null,
//                     null
//                 );
                
//                 parts.add(new Part(partNumber, response.etag()));
//                 partNumber++;
//             }
//         }
        
//         // Complete multipart upload
//         minioClient.completeMultipartUpload(
//             bucketName,
//             null,
//             objectName,
//             uploadId,
//             parts.toArray(new Part[0]),
//             null,
//             null
//         );
        
//         return objectName;
//     }
    
//     /**
//      * Get presigned URL for video streaming
//      */
//     public String getStreamingUrl(String objectName, int expiryHours) 
//         throws Exception {
        
//         return minioClient.getPresignedObjectUrl(
//             GetPresignedObjectUrlArgs.builder()
//                 .method(Method.GET)
//                 .bucket(bucketName)
//                 .object(objectName)
//                 .expiry(expiryHours * 3600)
//                 .build()
//         );
//     }
    
//     /**
//      * List chunks for a session
//      */
//     public List<String> listSessionChunks(String sessionId) throws Exception {
//         List<String> chunks = new ArrayList<>();
        
//         Iterable<Result<Item>> results = minioClient.listObjects(
//             ListObjectsArgs.builder()
//                 .bucket(bucketName)
//                 .prefix(sessionId + "/")
//                 .recursive(true)
//                 .build()
//         );
        
//         for (Result<Item> result : results) {
//             chunks.add(result.get().objectName());
//         }
        
//         return chunks;
//     }
// }