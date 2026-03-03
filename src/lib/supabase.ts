import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

// クライアントコンポーネント用のSupabaseクライアント
// auth-helpers を使用することで、ログイン時に自動的にクッキーが設定され、
// ミドルウェアやサーバーコンポーネントでセッションを共有できるようになります。
export const supabase = createClientComponentClient();
