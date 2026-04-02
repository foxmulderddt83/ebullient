import { supabase } from './supabase';

export interface AnalyticsEvent {
  action_type: 'click' | 'view' | 'session_start' | 'session_end' | 'custom';
  entity_type: 'video' | 'experience' | 'hero_slide' | 'feature' | 'page' | 'dynamic_panel' | 'custom';
  entity_id: string;
  entity_name?: string;
  details?: any;
}

// Simple device detection
const getDeviceType = () => {
  const ua = navigator.userAgent;
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    return "tablet";
  }
  if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
    return "mobile";
  }
  return "desktop";
};

// Simple browser detection
const getBrowser = () => {
  const ua = navigator.userAgent;
  if (ua.indexOf("Firefox") > -1) return "Firefox";
  if (ua.indexOf("SamsungBrowser") > -1) return "Samsung Internet";
  if (ua.indexOf("Opera") > -1 || ua.indexOf("OPR") > -1) return "Opera";
  if (ua.indexOf("Trident") > -1) return "Internet Explorer";
  if (ua.indexOf("Edge") > -1) return "Edge";
  if (ua.indexOf("Chrome") > -1) return "Chrome";
  if (ua.indexOf("Safari") > -1) return "Safari";
  return "Unknown";
};

let sessionInitialized = false;

export const trackEvent = async (event: AnalyticsEvent) => {
  try {
    // Get or create session ID
    let sessionId = sessionStorage.getItem('analytics_session_id');
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      sessionStorage.setItem('analytics_session_id', sessionId);
      // Track session start if not already tracked
      if (!sessionInitialized) {
        sessionInitialized = true;
        // Recursive call for session start, but ensure we don't loop
        if (event.action_type !== 'session_start') {
          trackEvent({
            action_type: 'session_start',
            entity_type: 'page',
            entity_id: window.location.pathname,
            entity_name: 'Session Start'
          });
        }
      }
    }

    // Get IP and Location info (only once per session ideally, but for simplicity we fetch or cache)
    let ipData = JSON.parse(sessionStorage.getItem('analytics_ip_data') || '{}');
    
    if (!ipData.ip) {
      try {
        const response = await fetch('https://ipapi.co/json/');
        if (response.ok) {
          ipData = await response.json();
          sessionStorage.setItem('analytics_ip_data', JSON.stringify(ipData));
        }
      } catch (e) {
        console.warn('Failed to fetch IP data', e);
      }
    }

    const payload = {
      session_id: sessionId,
      action_type: event.action_type,
      entity_type: event.entity_type,
      entity_id: event.entity_id,
      entity_name: event.entity_name || event.entity_id,
      ip_address: ipData.ip || 'unknown',
      country: ipData.country_name || 'unknown',
      city: ipData.city || 'unknown',
      device_type: getDeviceType(),
      browser: getBrowser(),
      os: navigator.platform, // simple OS detection
      isp: ipData.org || 'unknown', // Telco/ISP
      metadata: event.details || {},
      page_path: window.location.pathname
    };

    // Insert into Supabase
    // Note: This assumes the table 'user_interactions' exists
    const { error } = await supabase.from('user_interactions').insert(payload);

    if (error) {
      console.error('Analytics error:', error);
    }

  } catch (error) {
    console.error('Failed to track event:', error);
  }
};

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Hook for automatic page view tracking
export const usePageTracking = () => {
  const location = useLocation();

  useEffect(() => {
    trackEvent({
      action_type: 'view',
      entity_type: 'page',
      entity_id: location.pathname,
      entity_name: document.title || 'Page View'
    });
  }, [location]);
};
