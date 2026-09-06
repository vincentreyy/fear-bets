"use client";
import { Component } from "react";

export class ErrorBoundary extends Component {
  constructor(p) { super(p); this.state = { e: null }; }
  static getDerivedStateFromError(e) { return { e }; }
  render() {
    return this.state.e
      ? <div className="wrap" style={{ padding: 64 }}><div className="card"><div className="ttl-md">Something went wrong on this screen.</div><div className="muted2" style={{ fontSize: 13, margin: "8px 0 16px" }}>{String(this.state.e)}</div><button className="btn btn-y btn-sm" onClick={() => this.setState({ e: null })}>Reload screen</button></div></div>
      : this.props.children;
  }
}
