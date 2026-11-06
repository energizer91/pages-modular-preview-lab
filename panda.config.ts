import { green } from "./src/theme/colors/green";
import { red } from "./src/theme/colors/red";
import { sand } from "./src/theme/colors/sand";
import { teal } from "./src/theme/colors/teal";
import { animationStyles } from "./src/theme/animation-styles";
import { zIndex } from "./src/theme/tokens/z-index";
import { shadows } from "./src/theme/tokens/shadows";
import { durations } from "./src/theme/tokens/durations";
import { colors } from "./src/theme/tokens/colors";
import { textStyles } from "./src/theme/text-styles";
import { layerStyles } from "./src/theme/layer-styles";
import { keyframes } from "./src/theme/keyframes";
import { globalCss } from "./src/theme/global-css";
import { conditions } from "./src/theme/conditions";
import { slotRecipes, recipes } from "./src/theme/recipes";
import { defineConfig } from '@pandacss/dev'
export default defineConfig({
  presets: ['@pandacss/preset-base', '@pandacss/preset-panda'],
  preflight: true,
  include: ['./src/**/*.{ts,tsx}'],
  exclude: [],
  outdir: 'styled-system',
  staticCss: { recipes: { button: ['*'], badge: ['*'], table: ['*'] } },
  jsxFramework: 'react',
  globalCss: globalCss,
  conditions: conditions,

  theme: {
    extend: {
      animationStyles: animationStyles,
      recipes: recipes,
      slotRecipes: slotRecipes,
      keyframes: keyframes,
      layerStyles: layerStyles,
      textStyles: textStyles,

      tokens: {
        colors: colors,
        durations: durations,
        zIndex: zIndex
      },

      semanticTokens: {
        colors: {
          fg: {
            default: {
              value: {
                _light: "{colors.gray.12}",
                _dark: "{colors.gray.12}"
              }
            },

            muted: {
              value: {
                _light: "{colors.gray.11}",
                _dark: "{colors.gray.11}"
              }
            },

            subtle: {
              value: {
                _light: "{colors.gray.10}",
                _dark: "{colors.gray.10}"
              }
            }
          },

          border: {
            value: {
              _light: "{colors.gray.4}",
              _dark: "{colors.gray.4}"
            }
          },

          error: {
            value: {
              _light: "{colors.red.9}",
              _dark: "{colors.red.9}"
            }
          },

          teal: teal,
          gray: sand,
          red: red,
          green: green
        },

        shadows: shadows,

        radii: {
          l1: {
            value: "2px"
          },

          l2: {
            value: "6px"
          },

          l3: {
            value: "10px"
          }
        }
      }
    }
  }
})
