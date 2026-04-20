import fs from 'node:fs'
import path from 'node:path'

import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Divider from '@mui/material/Divider'
import Typography from '@mui/material/Typography'
import Link from 'next/link'

const readRunOrder = () => {
  try {
    const filePath = path.join(process.cwd(), 'supabase', 'sql', 'RUN_ORDER.md')

    return fs.readFileSync(filePath, 'utf8')
  } catch {
    return 'RUN_ORDER.md could not be read. Please open supabase/sql/RUN_ORDER.md in the repo.'
  }
}

const MigrationsRunOrderPage = () => {
  const content = readRunOrder()

  return (
    <Card className='mp-dashboard-section'>
      <CardContent className='flex flex-col gap-4'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <div>
            <Typography variant='h4'>Supabase Migration Run Order</Typography>
            <Typography className='text-textSecondary'>
              Run these SQL files in order to initialize the approval schema and admin queues.
            </Typography>
          </div>
          <Button component={Link} href='/admin' variant='outlined'>
            Back to Admin Console
          </Button>
        </div>
        <Divider />
        <pre className='whitespace-pre-wrap text-sm text-textPrimary'>{content}</pre>
      </CardContent>
    </Card>
  )
}

export default MigrationsRunOrderPage
