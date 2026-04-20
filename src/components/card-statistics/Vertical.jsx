'use client'

import { useEffect, useMemo, useState } from 'react'

import Chip from '@mui/material/Chip'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'

import CustomAvatar from '@core/components/mui/Avatar'
import OptionMenu from '@core/components/option-menu'

const ANIMATION_DURATION_MS = 720

const getTrendTone = trend => {
  if (trend === 'negative' || trend === 'down') {
    return 'down'
  }

  if (trend === 'neutral') {
    return 'neutral'
  }

  return 'up'
}

const parseAnimatedValue = stats => {
  if (typeof stats === 'number') {
    return {
      target: stats,
      format: value => value.toLocaleString('en-US')
    }
  }

  const text = String(stats ?? '')
  const match = text.match(/^(.*?)(-?\d[\d,]*(?:\.\d+)?)(.*)$/)

  if (!match) {
    return null
  }

  const [, prefix, rawNumber, suffix] = match
  const target = Number(rawNumber.replace(/,/g, ''))

  if (!Number.isFinite(target)) {
    return null
  }

  const decimalPlaces = rawNumber.includes('.') ? rawNumber.split('.')[1].length : 0

  return {
    target,
    format: value =>
      `${prefix}${value.toLocaleString('en-US', {
        minimumFractionDigits: decimalPlaces,
        maximumFractionDigits: decimalPlaces
      })}${suffix}`
  }
}

const CardStatVertical = props => {
  const {
    title,
    stats,
    avatarIcon,
    avatarColor,
    trendNumber,
    trend,
    trendLabel,
    subtitle,
    avatarSkin,
    avatarSize,
    moreOptions,
    cardClassName,
    badgeLabel,
    badgeColor = 'default',
    progressValue,
    progressLabel
  } = props

  const [animatedValue, setAnimatedValue] = useState(stats)
  const hasTrend = trendNumber !== undefined && trendNumber !== null && String(trendNumber).trim() !== ''
  const trendTone = getTrendTone(trend)
  const trendArrow = trendTone === 'down' ? '▼' : trendTone === 'neutral' ? '•' : '▲'

  const animationConfig = useMemo(() => parseAnimatedValue(stats), [stats])

  useEffect(() => {
    if (!animationConfig) {
      setAnimatedValue(stats)

      return undefined
    }

    let frameId = 0
    const startAt = performance.now()

    const tick = now => {
      const progress = Math.min((now - startAt) / ANIMATION_DURATION_MS, 1)
      const nextValue = animationConfig.target * progress

      setAnimatedValue(animationConfig.format(progress >= 1 ? animationConfig.target : nextValue))

      if (progress < 1) {
        frameId = window.requestAnimationFrame(tick)
      }
    }

    frameId = window.requestAnimationFrame(tick)

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [animationConfig, stats])

  return (
    <Card className={cardClassName ? `bs-full mp-fade-up ${cardClassName}` : 'bs-full mp-fade-up'}>
      <CardContent>
        <div className='mp-kpi-header mbe-5'>
          <CustomAvatar
            color={avatarColor}
            skin={avatarSkin}
            size={avatarSize}
            className={`shadow-xs mp-kpi-avatar${avatarColor === 'primary' ? ' mp-kpi-avatar--primary' : ''}`}
          >
            <i className={avatarIcon} />
          </CustomAvatar>
          {moreOptions ? <OptionMenu {...moreOptions} /> : <div className='mp-kpi-menu' aria-hidden='true' />}
        </div>
        <div className='flex flex-col gap-1'>
          <div className='mp-kpi-title-row'>
            <Typography color='text.primary' className='mp-kpi-title'>
              {title}
            </Typography>
            {badgeLabel ? <Chip size='small' color={badgeColor} variant='tonal' label={badgeLabel} /> : null}
          </div>
          <div className='flex gap-x-2 gap-y-1 items-center flex-wrap'>
            <Typography variant='h4' className='mp-kpi-value'>{animatedValue}</Typography>
            {hasTrend && (
              <span className={`mp-stat-trend-${trendTone}`}>
                <span aria-hidden='true'>{trendArrow}</span>
                <span>{`${trendTone === 'down' ? '-' : trendTone === 'neutral' ? '' : '+'}${trendNumber}`}</span>
                {trendLabel ? <span>{trendLabel}</span> : null}
              </span>
            )}
          </div>
          <div className='mp-kpi-subline'>
            <Typography variant='body2'>{subtitle}</Typography>
            {typeof progressValue === 'number' ? (
              <>
                <div className='mp-kpi-progress-track' aria-hidden='true'>
                  <div className='mp-kpi-progress-fill' style={{ inlineSize: `${Math.max(0, Math.min(progressValue, 100))}%` }} />
                </div>
                {progressLabel ? (
                  <Typography variant='caption' color='text.secondary'>
                    {progressLabel}
                  </Typography>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default CardStatVertical
