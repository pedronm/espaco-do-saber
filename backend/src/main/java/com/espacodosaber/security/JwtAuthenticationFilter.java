package com.espacodosaber.security;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    @Autowired
    private KeycloakTokenProvider keycloakTokenProvider;

    @Autowired
    private UserDetailsServiceImpl userDetailsService;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        System.out.println("[JWT FILTER] === START - Processing request: " + request.getRequestURI());
        try {
            String token = getJwtFromRequest(request);

            System.out.println("[JWT FILTER] Token extracted: " + (token != null ? "YES" : "NO"));

            if (StringUtils.hasText(token) && keycloakTokenProvider.validateKeycloakToken(token)) {
                System.out.println("[JWT FILTER] Token validated successfully with Keycloak");
                
                // Get user info from Keycloak
                JsonNode userInfo = keycloakTokenProvider.getUserInfoFromKeycloak(token);
                String username = userInfo.get("preferred_username").asText();
                
                System.out.println("[JWT FILTER] Username from Keycloak token: " + username);

                // Load user details from database (includes role/authorities)
                UserDetails userDetails = userDetailsService.loadUserByUsername(username);
                System.out.println("[JWT FILTER] UserDetails loaded: " + userDetails.getUsername());
                System.out.println("[JWT FILTER] Authorities: " + userDetails.getAuthorities());
                
                UsernamePasswordAuthenticationToken authentication =
                        new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities());
                authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));

                SecurityContextHolder.getContext().setAuthentication(authentication);
                System.out.println("[JWT FILTER] Authentication set in SecurityContext");
            } else {
                System.out.println("[JWT FILTER] Token validation failed or no token provided");
            }
        } catch (Exception ex) {
            logger.error("Could not set user authentication in security context", ex);
        }

        System.out.println("[JWT FILTER] === END - Passing to next filter");
        filterChain.doFilter(request, response);
    }

    private String getJwtFromRequest(HttpServletRequest request) {
        String bearerToken = request.getHeader("Authorization");
        if (StringUtils.hasText(bearerToken) && bearerToken.startsWith("Bearer ")) {
            return bearerToken.substring(7);
        }
        return null;
    }
}

