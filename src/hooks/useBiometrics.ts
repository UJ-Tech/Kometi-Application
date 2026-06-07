// src/hooks/useBiometrics.ts
// Biometric authentication hook — fingerprint / Face ID gate for sensitive actions.

import { useState, useEffect } from "react";
import * as LocalAuthentication from "expo-local-authentication";

interface BiometricState {
  isSupported:  boolean;
  isEnrolled:   boolean;
  biometricType: "fingerprint" | "face" | "none";
}

export function useBiometrics() {
  const [state, setState] = useState<BiometricState>({
    isSupported:  false,
    isEnrolled:   false,
    biometricType: "none",
  });

  useEffect(() => {
    (async () => {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled   = await LocalAuthentication.isEnrolledAsync();
      const types      = await LocalAuthentication.supportedAuthenticationTypesAsync();

      let biometricType: BiometricState["biometricType"] = "none";
      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        biometricType = "face";
      } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        biometricType = "fingerprint";
      }

      setState({ isSupported: compatible, isEnrolled: enrolled, biometricType });
    })();
  }, []);

  /**
   * Prompt biometric auth. Returns true if authenticated, false otherwise.
   * Callers should fall back to MPIN if biometric fails.
   */
  async function authenticate(reason = "Verify your identity"): Promise<boolean> {
    if (!state.isSupported || !state.isEnrolled) return false;

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage:         reason,
      cancelLabel:           "Use MPIN",
      disableDeviceFallback: false,
      fallbackLabel:         "Use MPIN instead",
    });

    return result.success;
  }

  return { ...state, authenticate };
}
