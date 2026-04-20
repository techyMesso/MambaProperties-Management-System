import ResetPassword from '@views/ResetPassword'
import { getServerMode } from '@core/utils/serverHelpers'

const ResetPasswordPage = async () => {
  const mode = await getServerMode()

  return <ResetPassword mode={mode} />
}

export default ResetPasswordPage
