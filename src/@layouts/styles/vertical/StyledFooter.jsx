// Third-party Imports
import styled from '@emotion/styled'

// Config Imports
import themeConfig from '@configs/themeConfig'

// Util Imports
import { verticalLayoutClasses } from '@layouts/utils/layoutClasses'

const StyledFooter = styled.footer`
  margin-inline: auto;
  max-inline-size: ${themeConfig.compactContentWidth}px;
  inline-size: 100%;

  & .${verticalLayoutClasses.footerContentWrapper} {
    padding-block: 10px 18px;
    padding-inline: ${themeConfig.layoutPadding}px;
    border: 1px solid var(--mui-palette-divider);
    border-radius: var(--mui-shape-customBorderRadius-lg);
    background-color: rgb(var(--mui-palette-background-paperChannel) / 0.86);
  }

  ${({ overrideStyles }) => overrideStyles}
`

export default StyledFooter
