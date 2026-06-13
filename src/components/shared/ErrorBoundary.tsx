// src/components/shared/ErrorBoundary.tsx
// High-fidelity ErrorBoundary with premium dark glassmorphic design.
// Allows users to recover, copy error details, or reload the app.

import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { View, Text, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
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
        <View className="flex-1 bg-surface-950 px-6 justify-center">
          <LinearGradient
            colors={[COLORS.brand[500] + "20", "transparent"]}
            className="absolute inset-0"
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 0.5 }}
          />

          <View className="items-center mb-8">
            <View className="w-20 h-20 bg-danger-500/10 rounded-full items-center justify-center mb-4 border border-danger-500/30">
              <Text className="text-danger-500 text-4xl">⚠️</Text>
            </View>
            <Text className="text-white text-2xl font-bold mb-2 text-center">
              Oops! Something went wrong
            </Text>
            <Text className="text-neutral-400 text-sm text-center px-4">
              An unexpected error occurred in Kometi. You can reload the screen or contact support if the issue persists.
            </Text>
          </View>

          <View className="bg-surface-card border border-brand-primary/10 rounded-xl p-4 mb-8 max-h-60">
            <Text className="text-danger-400 text-xs font-mono mb-2">
              {this.state.error?.toString()}
            </Text>
            {this.state.errorInfo && (
              <ScrollView>
                <Text className="text-neutral-500 text-[10px] font-mono leading-4">
                  {this.state.errorInfo.componentStack}
                </Text>
              </ScrollView>
            )}
          </View>

          <View className="flex-row gap-4">
            <View className="flex-1">
              <Button
                label="Try Again"
                onPress={this.handleReset}
                variant="primary"
              />
            </View>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
