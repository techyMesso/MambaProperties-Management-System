'use client'

// React Imports
import { useEffect, useMemo, useState } from 'react'

// MUI Imports
import Grid from '@mui/material/Grid'
import Tab from '@mui/material/Tab'
import TabContext from '@mui/lab/TabContext'
import TabList from '@mui/lab/TabList'
import TabPanel from '@mui/lab/TabPanel'

const TAB_META = {
  account: {
    label: 'Account',
    icon: 'ri-user-3-line'
  },
  notifications: {
    label: 'Notifications',
    icon: 'ri-notification-3-line'
  },
  connections: {
    label: 'Connections',
    icon: 'ri-link'
  }
}

const AccountSettings = ({ tabContentList }) => {
  const tabs = useMemo(() => Object.keys(tabContentList || {}), [tabContentList])

  // States
  const [activeTab, setActiveTab] = useState(tabs[0] || 'account')

  useEffect(() => {
    setActiveTab(previous => {
      if (!tabs.length) {
        return 'account'
      }

      return tabs.includes(previous) ? previous : tabs[0]
    })
  }, [tabs])

  const handleChange = (event, value) => {
    setActiveTab(value)
  }

  return (
    <TabContext value={activeTab}>
      <Grid container spacing={6}>
        {tabs.length > 1 ? (
          <Grid item xs={12}>
            <TabList onChange={handleChange} variant='scrollable'>
              {tabs.map(tab => (
                <Tab
                  key={tab}
                  label={TAB_META[tab]?.label || tab}
                  icon={<i className={TAB_META[tab]?.icon || 'ri-settings-3-line'} />}
                  iconPosition='start'
                  value={tab}
                />
              ))}
            </TabList>
          </Grid>
        ) : null}
        <Grid item xs={12}>
          <TabPanel value={activeTab} className='p-0'>
            {tabContentList[activeTab]}
          </TabPanel>
        </Grid>
      </Grid>
    </TabContext>
  )
}

export default AccountSettings
