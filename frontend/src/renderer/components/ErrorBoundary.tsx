import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Container, Title, Text, Button, Stack, Code, Paper } from '@mantine/core';
import { IconAlertTriangle, IconRefresh } from '@tabler/icons-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
    
    // Можно отправить ошибку в систему мониторинга (Sentry, LogRocket, etc.)
    // logErrorToService(error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Container size="md" style={{ paddingTop: '5rem' }}>
          <Paper p="xl" radius="md" withBorder>
            <Stack gap="lg" align="center">
              <IconAlertTriangle size={64} color="var(--mantine-color-red-6)" />
              
              <Title order={2} ta="center">
                Что-то пошло не так
              </Title>
              
              <Text size="sm" c="dimmed" ta="center">
                Произошла неожиданная ошибка. Попробуйте перезагрузить приложение.
              </Text>

              {this.state.error && (
                <Stack gap="sm" style={{ width: '100%' }}>
                  <Text size="sm" fw={600}>Детали ошибки:</Text>
                  <Code block style={{ overflow: 'auto', maxHeight: '200px' }}>
                    {this.state.error.toString()}
                    {this.state.errorInfo && (
                      <>
                        {'\n\n'}
                        {this.state.errorInfo.componentStack}
                      </>
                    )}
                  </Code>
                </Stack>
              )}

              <Button
                leftSection={<IconRefresh size={18} />}
                onClick={this.handleReset}
                size="lg"
                variant="filled"
              >
                Перезагрузить приложение
              </Button>

              <Text size="xs" c="dimmed">
                Если проблема повторяется, попробуйте переустановить приложение
              </Text>
            </Stack>
          </Paper>
        </Container>
      );
    }

    return this.props.children;
  }
}

