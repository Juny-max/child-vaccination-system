import nextConfig from "eslint-config-next"

const config = [
  {
    ignores: ["node_modules", ".next", "out"],
  },
  ...nextConfig,
  {
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
]

export default config
