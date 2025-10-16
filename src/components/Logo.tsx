// Copyright 2023-2025 Amazon.com, Inc. or its affiliates.

import React from 'react';
import './Logo.css';

const Logo: React.FC = () => {
  return (
    <div className="logo-container">
      <img
        src="/logo.png"
        alt="OSML Logo"
        className="logo-image"
      />
    </div>
  );
};

export default Logo;
