import type { NextConfig } from "next";

const config: NextConfig = {
  env: {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  },
};

export default config;
