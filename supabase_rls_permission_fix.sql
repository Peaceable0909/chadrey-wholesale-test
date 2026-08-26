grant usage on schema private to anon, authenticated;
grant execute on function private.is_admin() to anon, authenticated;
revoke execute on function private.handle_new_user() from public, anon, authenticated;
