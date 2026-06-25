// src/components/shared/ErrorBoundary.tsx
// ErrorBoundary — shows a clean error screen with recovery option.

import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { View, Text, ScrollView } from "react-native";
import { COLORS } from "../../constants/theme";
import Button from "../ui/Button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[Uncaught Error]:", error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: COLORS.surface.bg, paddingHorizontal: 24, justifyContent: "center" }}>
          <View style={{ alignItems: "center", marginBottom: 32 }}>
            <View style={{
              width: 64, height: 64, borderRadius: 16,
              backgroundColor: "rgba(239,68,68,0.1)",
              borderWidth: 1, borderColor: "rgba(239,68,68,0.2)",
              alignItems: "center", justifyContent: "center", marginBottom: 16,
            }}>
              <Text style={{ fontSize: 28 }}>⚠</Text>
            </View>
            <Text style={{ color: COLORS.text.primary, fontSize: 22, fontWeight: "700", marginBottom: 8, textAlign: "center" }}>
              Something went wrong
            </Text>
            <Text style={{ color: COLORS.text.secondary, fontSize: 14, textAlign: "center", paddingHorizontal: 16 }}>
              An unexpected error occurred. You can try again or contact support.
            </Text>
          </View>

          <View style={{
            backgroundColor: COLORS.surface.card,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: COLORS.surface.border,
            padding: 14, marginBottom: 32, maxHeight: 200,
          }}>
            <Text style={{ color: COLORS.danger.light, fontSize: 12, fontFamily: "monospace", marginBottom: 8 }}>
              {this.state.error?.toString()}
            </Text>
            {this.state.errorInfo && (
              <ScrollView>
                <Text style={{ color: COLORS.text.muted, fontSize: 10, fontFamily: "monospace", lineHeight: 16 }}>
                  {this.state.errorInfo.componentStack}
                </Text>
              </ScrollView>
            )}
          </View>

          <Button
            label="Try Again"
            onPress={this.handleReset}
            variant="primary"
          />
        </View>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
