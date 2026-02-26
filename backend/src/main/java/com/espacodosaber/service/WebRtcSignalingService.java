package com.espacodosaber.service;

import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

@Service
public class WebRtcSignalingService {

    private static final String ROLE_PUBLISHER = "publisher";
    private static final String ROLE_VIEWER = "viewer";

    private final Map<String, SignalingState> signalingByLiveId = new ConcurrentHashMap<>();

    public Map<String, Object> saveOffer(String liveId, String sdp, String type, String username) {
        SignalingState state = signalingByLiveId.computeIfAbsent(liveId, ignored -> new SignalingState());
        synchronized (state) {
            state.offerSdp = sdp;
            state.offerType = type;
            state.offerUsername = username;
        }
        return buildSdpResponse(true, sdp, type, username);
    }

    public Map<String, Object> getOffer(String liveId) {
        SignalingState state = signalingByLiveId.get(liveId);
        if (state == null) {
            return buildSdpResponse(false, null, null, null);
        }

        synchronized (state) {
            return buildSdpResponse(state.offerSdp != null, state.offerSdp, state.offerType, state.offerUsername);
        }
    }

    public Map<String, Object> saveAnswer(String liveId, String sdp, String type, String username) {
        SignalingState state = signalingByLiveId.computeIfAbsent(liveId, ignored -> new SignalingState());
        synchronized (state) {
            state.answerSdp = sdp;
            state.answerType = type;
            state.answerUsername = username;
        }
        return buildSdpResponse(true, sdp, type, username);
    }

    public Map<String, Object> getAnswer(String liveId) {
        SignalingState state = signalingByLiveId.get(liveId);
        if (state == null) {
            return buildSdpResponse(false, null, null, null);
        }

        synchronized (state) {
            return buildSdpResponse(state.answerSdp != null, state.answerSdp, state.answerType, state.answerUsername);
        }
    }

    public Map<String, Object> addCandidate(
            String liveId,
            String sourceRole,
            String candidate,
            String sdpMid,
            Integer sdpMLineIndex,
            String username
    ) {
        SignalingState state = signalingByLiveId.computeIfAbsent(liveId, ignored -> new SignalingState());
        String normalizedSourceRole = normalizeRole(sourceRole);
        String targetRole = ROLE_PUBLISHER.equals(normalizedSourceRole) ? ROLE_VIEWER : ROLE_PUBLISHER;

        CandidateMessage message = new CandidateMessage();
        message.id = state.candidateCounter.incrementAndGet();
        message.toRole = targetRole;
        message.candidate = candidate;
        message.sdpMid = sdpMid;
        message.sdpMLineIndex = sdpMLineIndex;
        message.username = username;
        message.createdAt = Instant.now();

        synchronized (state) {
            state.candidates.add(message);
        }

        Map<String, Object> response = new HashMap<>();
        response.put("accepted", true);
        response.put("candidateId", message.id);
        response.put("toRole", message.toRole);
        return response;
    }

    public Map<String, Object> getCandidates(String liveId, String targetRole, Long sinceId) {
        SignalingState state = signalingByLiveId.get(liveId);
        List<Map<String, Object>> items = new ArrayList<>();
        long maxId = sinceId != null ? sinceId : 0L;

        if (state != null) {
            String normalizedTarget = normalizeRole(targetRole);
            long threshold = sinceId != null ? sinceId : 0L;

            synchronized (state) {
                for (CandidateMessage candidate : state.candidates) {
                    boolean isTargetRole = normalizedTarget.equals(candidate.toRole);
                    boolean isAfterThreshold = candidate.id > threshold;
                    if (!(isTargetRole && isAfterThreshold)) {
                        continue;
                    }

                    Map<String, Object> row = new HashMap<>();
                    row.put("id", candidate.id);
                    row.put("candidate", candidate.candidate);
                    row.put("sdpMid", candidate.sdpMid);
                    row.put("sdpMLineIndex", candidate.sdpMLineIndex);
                    row.put("username", candidate.username);
                    row.put("createdAt", candidate.createdAt);
                    items.add(row);

                    if (candidate.id > maxId) {
                        maxId = candidate.id;
                    }
                }
            }
        }

        Map<String, Object> response = new HashMap<>();
        response.put("items", items);
        response.put("nextSinceId", maxId);
        return response;
    }

    public void reset(String liveId) {
        signalingByLiveId.remove(liveId);
    }

    private Map<String, Object> buildSdpResponse(boolean available, String sdp, String type, String username) {
        Map<String, Object> response = new HashMap<>();
        response.put("available", available);
        response.put("sdp", sdp);
        response.put("type", type);
        response.put("username", username);
        return response;
    }

    private String normalizeRole(String value) {
        if (value == null || value.isBlank()) {
            return ROLE_VIEWER;
        }

        String normalized = value.trim().toLowerCase();
        if (ROLE_PUBLISHER.equals(normalized)) {
            return ROLE_PUBLISHER;
        }

        return ROLE_VIEWER;
    }

    private static final class SignalingState {
        private String offerSdp;
        private String offerType;
        private String offerUsername;

        private String answerSdp;
        private String answerType;
        private String answerUsername;

        private final AtomicLong candidateCounter = new AtomicLong();
        private final List<CandidateMessage> candidates = new ArrayList<>();
    }

    private static final class CandidateMessage {
        private long id;
        private String toRole;
        private String candidate;
        private String sdpMid;
        private Integer sdpMLineIndex;
        private String username;
        private Instant createdAt;
    }
}
