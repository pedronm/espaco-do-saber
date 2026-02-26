package com.espacodosaber.service;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.io.IOException;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;

@Service
public class UdpStreamingBridgeService {

    private static final int MAGIC = 0x45534431;
    private static final byte FLAG_END_OF_STREAM = 0x1;
    private static final int FIXED_HEADER_SIZE = Integer.BYTES + 1 + Short.BYTES + Integer.BYTES + Integer.BYTES + Integer.BYTES;

    private final String udpHost;
    private final int udpPort;
    private final int udpMtu;
    private final String videoStreamingBaseUri;
    private final RestTemplate restTemplate = new RestTemplate();

    private DatagramSocket socket;
    private InetAddress targetAddress;

    public UdpStreamingBridgeService(
            @Value("${streaming.udp.host:video-streaming}") String udpHost,
            @Value("${streaming.udp.port:5005}") int udpPort,
            @Value("${streaming.udp.mtu:60000}") int udpMtu,
            @Value("${video-streaming.base-uri:http://video-streaming:8083}") String videoStreamingBaseUri
    ) {
        this.udpHost = udpHost;
        this.udpPort = udpPort;
        this.udpMtu = udpMtu;
        this.videoStreamingBaseUri = videoStreamingBaseUri;
    }

    @PostConstruct
    public void init() throws IOException {
        this.socket = new DatagramSocket();
        this.targetAddress = InetAddress.getByName(udpHost);
    }

    @PreDestroy
    public void destroy() {
        if (socket != null && !socket.isClosed()) {
            socket.close();
        }
    }

    public void sendChunk(String streamId, int sequence, byte[] payload) throws IOException {
        byte[] streamIdBytes = streamId.getBytes(StandardCharsets.UTF_8);
        int maxPayloadPerPacket = Math.max(1, udpMtu - (FIXED_HEADER_SIZE + streamIdBytes.length));
        int fragmentCount = (int) Math.ceil((double) payload.length / maxPayloadPerPacket);

        for (int fragmentIndex = 0; fragmentIndex < fragmentCount; fragmentIndex++) {
            int from = fragmentIndex * maxPayloadPerPacket;
            int to = Math.min(payload.length, from + maxPayloadPerPacket);
            int chunkLength = to - from;

            ByteBuffer buffer = ByteBuffer.allocate(FIXED_HEADER_SIZE + streamIdBytes.length + chunkLength);
            buffer.putInt(MAGIC);
            buffer.put((byte) 0);
            buffer.putShort((short) streamIdBytes.length);
            buffer.putInt(sequence);
            buffer.putInt(fragmentIndex);
            buffer.putInt(fragmentCount);
            buffer.put(streamIdBytes);
            buffer.put(payload, from, chunkLength);

            sendPacket(buffer.array());
        }
    }

    public void sendEndOfStream(String streamId, int finalSequence) throws IOException {
        byte[] streamIdBytes = streamId.getBytes(StandardCharsets.UTF_8);
        ByteBuffer buffer = ByteBuffer.allocate(FIXED_HEADER_SIZE + streamIdBytes.length);
        buffer.putInt(MAGIC);
        buffer.put(FLAG_END_OF_STREAM);
        buffer.putShort((short) streamIdBytes.length);
        buffer.putInt(finalSequence);
        buffer.putInt(0);
        buffer.putInt(0);
        buffer.put(streamIdBytes);
        sendPacket(buffer.array());
    }

    public void persistChunk(String streamId, int sequence, byte[] payload) {
        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("liveId", streamId);
        body.add("sequence", String.valueOf(sequence));
        body.add("chunk", new ByteArrayResource(payload) {
            @Override
            public String getFilename() {
                return "chunk-" + sequence + ".webm";
            }
        });

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);
        HttpEntity<MultiValueMap<String, Object>> request = new HttpEntity<>(body, headers);
        restTemplate.postForEntity(videoStreamingBaseUri + "/ingest/chunk", request, String.class);
    }

    public void persistEndOfStream(String streamId, int finalSequence) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        String json = String.format("{\"liveId\":\"%s\",\"sequence\":%d}", streamId, finalSequence);
        HttpEntity<String> request = new HttpEntity<>(json, headers);
        restTemplate.postForEntity(videoStreamingBaseUri + "/ingest/end", request, String.class);
    }

    public void persistFinalRecording(String streamId, byte[] payload) {
        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("liveId", streamId);
        body.add("file", new ByteArrayResource(payload) {
            @Override
            public String getFilename() {
                return "final.webm";
            }
        });

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);
        HttpEntity<MultiValueMap<String, Object>> request = new HttpEntity<>(body, headers);
        restTemplate.postForEntity(videoStreamingBaseUri + "/ingest/final", request, String.class);
    }

    private void sendPacket(byte[] bytes) throws IOException {
        DatagramPacket packet = new DatagramPacket(bytes, bytes.length, targetAddress, udpPort);
        socket.send(packet);
    }
}