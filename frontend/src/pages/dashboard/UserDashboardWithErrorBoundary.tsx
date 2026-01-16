import React from 'react';
import { Result, Button } from 'antd';

interface Props {
  children: React.ReactNode;
}
interface State {
  hasError: boolean;
  error?: Error;
}

export class DashboardErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Dashboard Error:', error);
    console.error('Error Info:', errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '50px', textAlign: 'center' }}>
          <Result
            status="error"
            title="Dashboard Loading Failed"
            subTitle={
              <div>
                <p>Error: {this.state.error?.message}</p>
                <p style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>
                  Stack: {this.state.error?.stack?.substring(0, 200)}...
                </p>
              </div>
            }
            extra={[
              <Button type="primary" key="reload" onClick={() => window.location.reload()}>
                Reload Page
              </Button>,
              <Button key="back" onClick={() => window.location.href = '/'}>
                Go to Home
              </Button>,
            ]}
          />
        </div>
      );
    }

    return this.props.children;
  }
}
