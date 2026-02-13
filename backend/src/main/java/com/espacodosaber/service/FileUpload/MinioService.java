// package com.project.videoserver;

// import javax.websocket.*;
// import javax.websocket.server.ServerEndpoint;
// import java.io.*;
// import java.nio.ByteBuffer;
// import java.util.concurrent.ConcurrentHashMap;
// import java.util.concurrent.atomic.AtomicInteger;

// @ServerEndpoint("/video/upload")
// public class MinioService {
    
//     private static final ConcurrentHashMap<String, VideoSession> sessions = 
//         new ConcurrentHashMap<>();
    
//     @OnOpen
//     public void onOpen(Session session) {
//         String sessionId = session.getId();
//         sessions.put(sessionId, new VideoSession(sessionId));
//         System.out.println("New video streaming session: " + sessionId);
//     }
    
//     @OnMessage
//     public void onMessage(Session session, ByteBuffer videoChunk) {
//         String sessionId = session.getId();
//         VideoSession videoSession = sessions.get(sessionId);
        
//         try {
//             // Process chunk
//             byte[] chunkData = new byte[videoChunk.remaining()];
//             videoChunk.get(chunkData);
            
//             // Add to session buffer
//             videoSession.addChunk(chunkData);
            
//             // Optional: Send acknowledgment
//             if (session.isOpen()) {
//                 session.getAsyncRemote().sendText(
//                     String.format("CHUNK_RECEIVED:%d:%d", 
//                         videoSession.getChunkCount(), 
//                         chunkData.length)
//                 );
//             }
            
//             // Auto-save every 10 chunks or 10MB
//             if (videoSession.shouldSave()) {
//                 saveVideoSession(videoSession);
//             }
            
//         } catch (Exception e) {
//             e.printStackTrace();
//             session.getAsyncRemote().sendText("ERROR:" + e.getMessage());
//         }
//     }
    
//     @OnClose
//     public void onClose(Session session) {
//         String sessionId = session.getId();
//         VideoSession videoSession = sessions.remove(sessionId);
        
//         if (videoSession != null && videoSession.hasData()) {
//             // Final save on session close
//             saveVideoSession(videoSession);
//         }
//         System.out.println("Session closed: " + sessionId);
//     }
    
//     private void saveVideoSession(VideoSession session) {
//         // Implement MinIO upload here
//         System.out.println("Saving session " + session.getId() + 
//                           " with " + session.getChunkCount() + " chunks");
//     }
// }

// class VideoSession {
//     private final String id;
//     private final ByteArrayOutputStream buffer;
//     private final AtomicInteger chunkCount;
//     private long lastSaveTime;
    
//     public VideoSession(String id) {
//         this.id = id;
//         this.buffer = new ByteArrayOutputStream();
//         this.chunkCount = new AtomicInteger(0);
//         this.lastSaveTime = System.currentTimeMillis();
//     }
    
//     public synchronized void addChunk(byte[] chunk) throws IOException {
//         buffer.write(chunk);
//         chunkCount.incrementAndGet();
//     }
    
//     public boolean shouldSave() {
//         return chunkCount.get() >= 10 || 
//                buffer.size() >= 10 * 1024 * 1024 || 
//                (System.currentTimeMillis() - lastSaveTime) >= 30000;
//     }
    
//     public boolean hasData() {
//         return buffer.size() > 0;
//     }
    
//     public byte[] getData() {
//         return buffer.toByteArray();
//     }
    
//     // Getters
//     public String getId() { return id; }
//     public int getChunkCount() { return chunkCount.get(); }
// }