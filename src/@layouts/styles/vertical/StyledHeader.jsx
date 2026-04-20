// Third-party Imports
import styled from '@emotion/styled'

// Config Imports
import themeConfig from '@configs/themeConfig'

// Util Imports
import { verticalLayoutClasses } from '@layouts/utils/layoutClasses'

const StyledHeader = styled.header`
  display: flex;
  align-items: center;
  justify-content: center;
  inline-size: 100%;
  flex-shrink: 0;
  min-block-size: var(--header-height);
  padding-block: 12px 8px;
  position: sticky;
  inset-block-start: 0;
  z-index: var(--header-z-index);
  backdrop-filter: blur(10px);
  background: rgb(var(--mui-palette-background-defaultChannel) / 0.72);

  .${verticalLayoutClasses.navbar} {
    position: relative;
    padding-block: 8px;
    padding-inline: ${themeConfig.layoutPadding}px;
    inline-size: 100%;
    margin-inline: auto;
    max-inline-size: ${themeConfig.compactContentWidth}px;
    border: 1px solid var(--mui-palette-divider);
    border-radius: var(--mui-shape-customBorderRadius-lg);
    background-color: rgb(var(--mui-palette-background-paperChannel) / 0.88);
    box-shadow: var(--mui-customShadows-xs);
  }

  ${({ overrideStyles }) => overrideStyles}
`

export default StyledHeader
