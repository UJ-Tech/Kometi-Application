// src/components/ui/AlertModal.tsx
// Custom mobile alert modal — replaces native Alert.alert with a styled popup.

import React, { useState, useCallback, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, BORDER_RADIUS, SPACING, FONT_SIZE } from "../../constants/theme";

type AlertType = "info" | "success" | "warning" | "error";

interface AlertConfig {
  visible: boolean;
  title: string;
  message: string;
  type?: AlertType;
  confirmLabel?: string;
  cancelLabel?: string;
  showCancel?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
  resolve?: (value: boolean) => void;
}

const ICON_MAP: Record<AlertType, { name: keyof typeof Ionicons.glyphMap; color: string; bg: string }> = {
  info:    { name: "information-circle",   color: COLORS.info.dark,    bg: "rgba(14,165,233,0.10)" },
  success: { name: "checkmark-circle",     color: COLORS.success.dark, bg: "rgba(34,197,94,0.10)" },
  warning: { name: "warning",              color: COLORS.warning.dark, bg: "rgba(234,179,8,0.10)" },
  error:   { name: "close-circle",         color: COLORS.danger.dark,  bg: "rgba(239,68,68,0.10)" },
};

export function AlertModal({ config, onClose }: { config: AlertConfig; onClose: () => void }) {
  const icon = ICON_MAP[config.type ?? "info"];

  const handleConfirm = () => {
    config.onConfirm?.();
    config.resolve?.(true);
    onClose();
  };

  const handleCancel = () => {
    config.onCancel?.();
    config.resolve?.(false);
    onClose();
  };

  return (
    <Modal
      visible={config.visible}
      transparent
      animationType="fade"
      onRequestClose={config.showCancel ? handleCancel : handleConfirm}
    >
      <TouchableWithoutFeedback onPress={config.showCancel ? handleCancel : undefined}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.dialog}>
              <View style={[styles.iconContainer, { backgroundColor: icon.bg }]}>
                <Ionicons name={icon.name} size={32} color={icon.color} />
              </View>

              <Text style={styles.title}>{config.title}</Text>
              <Text style={styles.message}>{config.message}</Text>

              <View style={styles.buttonRow}>
                {config.showCancel && (
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={handleCancel}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.cancelText}>{config.cancelLabel ?? "Cancel"}</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[
                    styles.confirmButton,
                    config.showCancel ? styles.confirmButtonHalf : null,
                    config.type === "error" && styles.confirmButtonDanger,
                  ]}
                  onPress={handleConfirm}
                  activeOpacity={0.8}
                >
                  <Text style={styles.confirmText}>{config.confirmLabel ?? "OK"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

// ─── Promise-based hook for imperative usage ──────────────────────────────────

let globalId = 0;

export function useAlertModal() {
  const [config, setConfig] = useState<AlertConfig & { id: number }>({
    visible: false,
    title: "",
    message: "",
    id: 0,
  });

  const close = useCallback(() => {
    setConfig((prev) => ({ ...prev, visible: false }));
  }, []);

  const alert = useCallback(
    (
      title: string,
      message: string,
      options?: {
        type?: AlertType;
        confirmLabel?: string;
      }
    ): Promise<void> => {
      return new Promise((resolve) => {
        setConfig({
          visible: true,
          title,
          message,
          type: options?.type,
          confirmLabel: options?.confirmLabel ?? "OK",
          showCancel: false,
          onConfirm: () => resolve(),
          id: ++globalId,
        });
      });
    },
    []
  );

  const confirm = useCallback(
    (
      title: string,
      message: string,
      options?: {
        type?: AlertType;
        confirmLabel?: string;
        cancelLabel?: string;
      }
    ): Promise<boolean> => {
      return new Promise((resolve) => {
        setConfig({
          visible: true,
          title,
          message,
          type: options?.type,
          confirmLabel: options?.confirmLabel ?? "Confirm",
          cancelLabel: options?.cancelLabel ?? "Cancel",
          showCancel: true,
          resolve,
          id: ++globalId,
        });
      });
    },
    []
  );

  const AlertComponent = useCallback(
    () => <AlertModal config={config} onClose={close} />,
    [config.visible, config.id, config.title, config.message]
  );

  return { alert, confirm, AlertComponent };
}

// ─── Static styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: SPACING[6],
  },
  dialog: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: COLORS.surface.card,
    borderRadius: BORDER_RADIUS["2xl"],
    borderWidth: 1,
    borderColor: COLORS.surface.border,
    padding: SPACING[6],
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING[4],
  },
  title: {
    fontSize: FONT_SIZE.lg,
    fontWeight: "700",
    color: COLORS.text.primary,
    textAlign: "center",
    marginBottom: SPACING[2],
  },
  message: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.text.secondary,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: SPACING[6],
  },
  buttonRow: {
    flexDirection: "row",
    width: "100%",
    gap: SPACING[3],
  },
  cancelButton: {
    flex: 1,
    height: 48,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.surface.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surface.bg,
  },
  cancelText: {
    fontSize: FONT_SIZE.md,
    fontWeight: "600",
    color: COLORS.text.secondary,
  },
  confirmButton: {
    flex: 1,
    height: 48,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.brand[500],
    alignItems: "center",
    justifyContent: "center",
  },
  confirmButtonHalf: {},
  confirmButtonDanger: {
    backgroundColor: COLORS.danger.DEFAULT,
  },
  confirmText: {
    fontSize: FONT_SIZE.md,
    fontWeight: "600",
    color: COLORS.white,
  },
});
