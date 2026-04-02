export default {
  extends: ["stylelint-config-standard"],
  rules: {
    "declaration-block-no-redundant-longhand-properties": true,
    "selector-class-pattern": [
      "^(?:[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:__[a-z0-9]+)?(?:--[a-z0-9]+)?|edgeLabel|labelBkg|edgePath)$",
      {
        message: "Use lowercase kebab-case or BEM-style class names."
      }
    ]
  }
};
