'use client'

import styled from '@emotion/styled'

import themeConfig from '@configs/themeConfig'

const BrandWrap = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-block-size: 28px;
`

const BrandMark = styled.span`
  inline-size: 30px;
  block-size: 30px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: DM Sans, Circular, -apple-system, system-ui, sans-serif;
  font-size: 0.95rem;
  font-weight: 800;
  color: #fff;
  background: #ff385c;
  box-shadow: rgb(0 0 0 / 0.02) 0px 0px 0px 1px, rgb(0 0 0 / 0.04) 0px 2px 6px, rgb(0 0 0 / 0.1) 0px 4px 8px;
`

const BrandTextWrap = styled.span`
  display: inline-flex;
  flex-direction: column;
  line-height: 1.1;
`

const BrandTitle = styled.span`
  color: ${({ color }) => color ?? 'var(--mui-palette-text-primary)'};
  font-family: DM Sans, Circular, -apple-system, system-ui, sans-serif;
  font-size: 1.05rem;
  font-weight: 600;
  letter-spacing: -0.018em;
`

const BrandSub = styled.span`
  color: rgb(var(--mui-palette-text-primaryChannel) / 0.58);
  font-size: 0.68rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
`

const Logo = ({ color }) => {
  return (
    <BrandWrap>
      <BrandMark>M</BrandMark>
      <BrandTextWrap>
        <BrandTitle color={color}>{themeConfig.templateName}</BrandTitle>
        <BrandSub>Property Platform</BrandSub>
      </BrandTextWrap>
    </BrandWrap>
  )
}

export default Logo
