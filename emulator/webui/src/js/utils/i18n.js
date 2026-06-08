// i18n.js
import { Store } from "../core/store.js";
import { Paths } from "./paths.js";
import { log } from "./logger.js";

export const LangIndex = {
  ENGLISH: 0,
  ITALIAN: 1,
  FRENCH: 2,
  GERMAN: 3,
  SPANISH: 4
};

const APP_TRANSLATIONS = {
  [LangIndex.ENGLISH]: {
    ui: {
      loading: "Loading...",
      error: "Error",
      save: "Save",
      cancel: "Cancel",
      confirm: "Confirm",
      close: "Close",
      ok: "OK",
      back: "Back",
      
      // Connection states
      connected: "CONNECTED",
      connecting: "CONNECTING",
      disconnected: "DISCONNECTED",
      reconnecting: "RECONNECTING",

      // Dashboard
      dashboardTitle: "ECU TEST SYSTEM",
      rpm: "Engine Speed (RPM)",
      tps: "Throttle Position (TPS)",
      egt: "Exhaust Gas Temp (EGT)",
      ignitionAdvance: "Ignition Timing Advance",
      sparkDetected: "Spark Detected",
      sparkActive: "Spark Active",
      sparkInactive: "No Spark",
      qsTrigger: "QUICK SHIFT",
      manualOverride: "Manual Override",
      physicalInput: "Physical Input",
      egtFault: "EGT Overheat Fault",
      configure: "Configure",

      // Overrides
      rpmOverrideTitle: "RPM Override Configuration",
      rpmOverrideDesc: "Manually override the engine speed. Bypasses physical TPS kinematics.",
      tpsOverrideTitle: "TPS Override Configuration",
      tpsOverrideDesc: "Manually override Throttle Position Sensor. Virtual input takes precedence.",
      egtOverrideTitle: "EGT Override Configuration",
      egtOverrideDesc: "Manually override Exhaust Gas Temp. Bypasses superloop simulation.",
      
      targetRpm: "Target RPM",
      targetTps: "Target Throttle (%)",
      targetEgt: "Target Temperature (°C)",
      
      overrideToggle: "Enable Virtual Override",
      injectFaultToggle: "Inject EGT Overheat Fault (>800°C)",
      adcValue: "Physical Input Value",
      presets: "Quick Presets",
      active: "Active",
      inactive: "Inactive"
    }
  }
};

class I18n {
  getCurrentLangIndex() {
    // Always return English for the ECU simulator redesign (English-only)
    return LangIndex.ENGLISH;
  }

  t(key, params = {}) {
    const langIndex = this.getCurrentLangIndex();
    const translations = APP_TRANSLATIONS[langIndex];

    if (!translations) {
      return key;
    }
    
    const text = this._getNestedValue(translations, key);
    if (!text) {
      log.warn(`Missing translation for key: ${key}`);
      return key;
    }
    
    return this._interpolate(text, params);
  }

  // Fallback stubs for FOG EXTRA compatibility
  tMenu(menuId) {
    const menuNames = {
      0: "Dashboard",
      1: "RPM Settings",
      2: "TPS Settings",
      3: "EGT Settings"
    };
    return menuNames[menuId] || `Menu ${menuId}`;
  }

  tParam(paramId) {
    return { name: `Param ${paramId}`, ds: '' };
  }

  tDay(dayIndex) {
    const days = ["M", "T", "W", "T", "F", "S", "S"];
    return days[dayIndex] || '';
  }

  tEnum(enumType, value) {
    return String(value);
  }

  _getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  _interpolate(text, params) {
    return text.replace(/\{(\w+)\}/g, (match, key) => {
      return params.hasOwnProperty(key) ? params[key] : match;
    });
  }
}

export const i18n = new I18n();
export default I18n;
