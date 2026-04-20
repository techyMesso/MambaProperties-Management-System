'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import {
  Card,
  CardContent,
  Grid,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Box,
  Button,
  TextField,
  Paper
} from '@mui/material'
import DownloadIcon from '@mui/icons-material/Download'

export default function IncomeAnalyticsAdminView() {
  const [metrics, setMetrics] = useState(null)
  const [incomeData, setIncomeData] = useState([])

  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  })

  const calculateMetrics = data => {
    const byType = {}
    let total = 0
    let confirmed = 0
    let pending = 0

    data.forEach(record => {
      if (!byType[record.income_type]) {
        byType[record.income_type] = { amount: 0, count: 0 }
      }

      byType[record.income_type].amount += record.amount || 0
      byType[record.income_type].count += 1
      total += record.amount || 0

      if (record.status === 'confirmed') {
        confirmed += record.amount || 0
      } else if (record.status === 'pending') {
        pending += record.amount || 0
      }
    })

    return {
      total,
      confirmed,
      pending,
      byType,
      tenantSubscriptions: byType['tenant_subscription'] || { amount: 0, count: 0 },
      marketplaceFees: byType['landlord_marketplace_listing'] || { amount: 0, count: 0 },
      managementModuleFees: byType['landlord_management_module'] || { amount: 0, count: 0 },
      commissions: byType['commission_from_rent_payment'] || { amount: 0, count: 0 }
    }
  }

  useEffect(() => {
    let isMounted = true

    const loadMetrics = async () => {
      try {
        const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

        // Get all income records for selected date range
        const { data: records, error } = await supabase
          .from('platform_income')
          .select('income_type, amount, status, collected_at, metadata')
          .gte('collected_at', `${dateRange.startDate}T00:00:00Z`)
          .lte('collected_at', `${dateRange.endDate}T23:59:59Z`)
          .order('collected_at', { ascending: false })

        if (error) {
          console.error('Error loading metrics:', error)

          return
        }

        if (!isMounted) {
          return
        }

        setIncomeData(records || [])
        setMetrics(calculateMetrics(records || []))
      } catch (error) {
        console.error('Error loading metrics:', error)
      }
    }

    loadMetrics()

    return () => {
      isMounted = false
    }
  }, [dateRange.endDate, dateRange.startDate])

  const handleExport = () => {
    // Create CSV from incomeData
    const headers = ['Income Type', 'Amount (KES)', 'Status', 'Date', 'Metadata']

    const rows = incomeData.map(record => [
      record.income_type,
      record.amount || 0,
      record.status,
      new Date(record.collected_at).toLocaleDateString(),
      record.metadata ? JSON.stringify(record.metadata) : ''
    ])

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')

    a.href = url
    a.download = `mamba-income-${dateRange.startDate}-to-${dateRange.endDate}.csv`
    a.click()
  }

  if (!metrics) {
    return (
      <Card>
        <CardContent className='flex items-center justify-center min-h-[300px]'>
          <CircularProgress />
        </CardContent>
      </Card>
    )
  }

  return (
    <Grid container spacing={3}>
      {/* Date Range Filter */}
      <Grid item xs={12}>
        <Paper sx={{ p: 2 }}>
          <Grid container spacing={2} alignItems='center'>
            <Grid item xs={12} sm={4}>
              <TextField
                type='date'
                label='Start Date'
                value={dateRange.startDate}
                onChange={e => setDateRange({ ...dateRange, startDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <TextField
                type='date'
                label='End Date'
                value={dateRange.endDate}
                onChange={e => setDateRange({ ...dateRange, endDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <Button variant='outlined' startIcon={<DownloadIcon />} onClick={handleExport} fullWidth>
                Export CSV
              </Button>
            </Grid>
          </Grid>
        </Paper>
      </Grid>

      {/* Key Metrics */}
      <Grid item xs={12} sm={6} md={3}>
        <Card>
          <CardContent>
            <Typography color='text.secondary' gutterBottom>
              Total Income
            </Typography>
            <Typography variant='h5'>KES {(metrics.total || 0).toLocaleString()}</Typography>
            <Typography variant='body2' color='text.secondary'>
              {incomeData.length} transactions
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <Card>
          <CardContent>
            <Typography color='text.secondary' gutterBottom>
              Confirmed Income
            </Typography>
            <Typography variant='h5' sx={{ color: 'success.main' }}>
              KES {(metrics.confirmed || 0).toLocaleString()}
            </Typography>
            <Typography variant='body2' color='text.secondary'>
              Ready to withdraw
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <Card>
          <CardContent>
            <Typography color='text.secondary' gutterBottom>
              Pending Income
            </Typography>
            <Typography variant='h5' sx={{ color: 'warning.main' }}>
              KES {(metrics.pending || 0).toLocaleString()}
            </Typography>
            <Typography variant='body2' color='text.secondary'>
              Awaiting payment confirmation
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <Card>
          <CardContent>
            <Typography color='text.secondary' gutterBottom>
              Average Transaction
            </Typography>
            <Typography variant='h5'>
              KES {incomeData.length > 0 ? Math.round(metrics.total / incomeData.length).toLocaleString() : '0'}
            </Typography>
            <Typography variant='body2' color='text.secondary'>
              Per transaction
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      {/* Income Breakdown by Type */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant='h6' gutterBottom>
              Income by Type
            </Typography>
            <TableContainer>
              <Table size='small'>
                <TableHead>
                  <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                    <TableCell>Income Type</TableCell>
                    <TableCell align='right'>Count</TableCell>
                    <TableCell align='right'>Total Amount</TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  <TableRow>
                    <TableCell>Tenant Subscriptions</TableCell>
                    <TableCell align='right'>{metrics.tenantSubscriptions.count}</TableCell>
                    <TableCell align='right'>
                      KES {(metrics.tenantSubscriptions.amount || 0).toLocaleString()}
                    </TableCell>
                  </TableRow>

                  <TableRow>
                    <TableCell>Marketplace Listing</TableCell>
                    <TableCell align='right'>{metrics.marketplaceFees.count}</TableCell>
                    <TableCell align='right'>KES {(metrics.marketplaceFees.amount || 0).toLocaleString()}</TableCell>
                  </TableRow>

                  <TableRow>
                    <TableCell>Management Module</TableCell>
                    <TableCell align='right'>{metrics.managementModuleFees.count}</TableCell>
                    <TableCell align='right'>
                      KES {(metrics.managementModuleFees.amount || 0).toLocaleString()}
                    </TableCell>
                  </TableRow>

                  <TableRow>
                    <TableCell>Rent Commissions</TableCell>
                    <TableCell align='right'>{metrics.commissions.count}</TableCell>
                    <TableCell align='right'>KES {(metrics.commissions.amount || 0).toLocaleString()}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Grid>

      {/* Income Status Distribution */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant='h6' gutterBottom>
              Income Status
            </Typography>
            <Box sx={{ pt: 2 }}>
              {Object.entries(
                incomeData.reduce((acc, record) => {
                  acc[record.status] = (acc[record.status] || 0) + 1

                  return acc
                }, {})
              ).map(([status, count]) => (
                <Box key={status} sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant='body2' sx={{ textTransform: 'capitalize' }}>
                      {status}
                    </Typography>
                    <Typography variant='body2' sx={{ fontWeight: 'bold' }}>
                      {count} transactions
                    </Typography>
                  </Box>

                  <Box
                    sx={{
                      height: 8,
                      backgroundColor: '#e0e0e0',
                      borderRadius: 1,
                      overflow: 'hidden'
                    }}
                  >
                    <Box
                      sx={{
                        height: '100%',
                        width: `${(count / incomeData.length) * 100}%`,
                        backgroundColor: status === 'confirmed' ? '#4caf50' : '#ff9800',
                        transition: 'width 0.3s ease'
                      }}
                    />
                  </Box>
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>
      </Grid>

      {/* Recent Income Transactions */}
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant='h6' gutterBottom>
              Recent Transactions (Last 30)
            </Typography>
            <TableContainer>
              <Table size='small'>
                <TableHead>
                  <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                    <TableCell>Date</TableCell>
                    <TableCell>Income Type</TableCell>
                    <TableCell align='right'>Amount</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {incomeData.slice(0, 30).map((record, idx) => (
                    <TableRow key={idx} hover>
                      <TableCell>
                        {new Date(record.collected_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </TableCell>

                      <TableCell sx={{ textTransform: 'capitalize' }}>
                        {record.income_type?.replace(/_/g, ' ')}
                      </TableCell>

                      <TableCell align='right'>
                        <Typography sx={{ fontWeight: 'bold' }}>KES {(record.amount || 0).toLocaleString()}</Typography>
                      </TableCell>

                      <TableCell>
                        <Typography
                          variant='body2'
                          sx={{
                            textTransform: 'capitalize',
                            color: record.status === 'confirmed' ? 'success.main' : 'warning.main',
                            fontWeight: 'bold'
                          }}
                        >
                          {record.status}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  )
}
