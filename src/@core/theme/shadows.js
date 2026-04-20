const shadows = mode => {
  const isLight = mode === 'light'
  const soft = isLight ? 'rgb(0 0 0 / 0.04)' : 'rgb(0 0 0 / 0.34)'
  const base = isLight ? 'rgb(0 0 0 / 0.08)' : 'rgb(0 0 0 / 0.42)'
  const strong = isLight ? 'rgb(0 0 0 / 0.12)' : 'rgb(0 0 0 / 0.5)'

  return [
    'none',
    `${soft} 0px 0px 0px 1px, ${soft} 0px 1px 2px, ${base} 0px 2px 4px`,
    `${soft} 0px 0px 0px 1px, ${soft} 0px 2px 4px, ${base} 0px 3px 6px`,
    `${soft} 0px 0px 0px 1px, ${soft} 0px 2px 6px, ${base} 0px 4px 8px`,
    `${soft} 0px 0px 0px 1px, ${soft} 0px 4px 8px, ${base} 0px 6px 12px`,
    `${soft} 0px 0px 0px 1px, ${soft} 0px 6px 10px, ${base} 0px 8px 16px`,
    `${soft} 0px 0px 0px 1px, ${soft} 0px 8px 14px, ${base} 0px 10px 20px`,
    `${soft} 0px 0px 0px 1px, ${soft} 0px 10px 16px, ${base} 0px 12px 24px`,
    `${soft} 0px 0px 0px 1px, ${soft} 0px 12px 18px, ${base} 0px 14px 28px`,
    `${soft} 0px 0px 0px 1px, ${soft} 0px 14px 20px, ${base} 0px 16px 32px`,
    `${soft} 0px 0px 0px 1px, ${soft} 0px 16px 22px, ${base} 0px 18px 36px`,
    `${soft} 0px 0px 0px 1px, ${soft} 0px 18px 24px, ${base} 0px 20px 40px`,
    `${soft} 0px 0px 0px 1px, ${soft} 0px 20px 28px, ${base} 0px 22px 44px`,
    `${soft} 0px 0px 0px 1px, ${soft} 0px 22px 30px, ${strong} 0px 24px 48px`,
    `${soft} 0px 0px 0px 1px, ${soft} 0px 24px 32px, ${strong} 0px 26px 52px`,
    `${soft} 0px 0px 0px 1px, ${soft} 0px 26px 34px, ${strong} 0px 28px 56px`,
    `${soft} 0px 0px 0px 1px, ${soft} 0px 28px 36px, ${strong} 0px 30px 60px`,
    `${soft} 0px 0px 0px 1px, ${soft} 0px 30px 40px, ${strong} 0px 32px 64px`,
    `${soft} 0px 0px 0px 1px, ${soft} 0px 32px 42px, ${strong} 0px 34px 68px`,
    `${soft} 0px 0px 0px 1px, ${soft} 0px 34px 44px, ${strong} 0px 36px 72px`,
    `${soft} 0px 0px 0px 1px, ${soft} 0px 36px 46px, ${strong} 0px 38px 76px`,
    `${soft} 0px 0px 0px 1px, ${soft} 0px 38px 48px, ${strong} 0px 40px 80px`,
    `${soft} 0px 0px 0px 1px, ${soft} 0px 40px 52px, ${strong} 0px 42px 84px`,
    `${soft} 0px 0px 0px 1px, ${soft} 0px 42px 54px, ${strong} 0px 44px 88px`,
    `${soft} 0px 0px 0px 1px, ${soft} 0px 44px 56px, ${strong} 0px 46px 92px`
  ]
}

export default shadows
