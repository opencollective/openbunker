-- Enable Row Level Security on all tables
ALTER TABLE "Keys" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Apps" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Perms" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Pending" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "History" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SyncHistory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ConnectTokens" ENABLE ROW LEVEL SECURITY;

-- Create policies for Keys table
CREATE POLICY "Users can only access their own keys" ON "Keys"
    FOR ALL USING (npub = current_setting('app.npub', true));

-- Create policies for Apps table
CREATE POLICY "Users can only access their own apps" ON "Apps"
    FOR ALL USING (npub = current_setting('app.npub', true));

-- Create policies for Perms table
CREATE POLICY "Users can only access their own permissions" ON "Perms"
    FOR ALL USING (npub = current_setting('app.npub', true));

-- Create policies for Pending table
CREATE POLICY "Users can only access their own pending requests" ON "Pending"
    FOR ALL USING (npub = current_setting('app.npub', true));

-- Create policies for History table
CREATE POLICY "Users can only access their own history" ON "History"
    FOR ALL USING (npub = current_setting('app.npub', true));

-- Create policies for SyncHistory table
CREATE POLICY "Users can only access their own sync history" ON "SyncHistory"
    FOR ALL USING (npub = current_setting('app.npub', true));

-- Create policies for ConnectTokens table
CREATE POLICY "Users can only access their own connect tokens" ON "ConnectTokens"
    FOR ALL USING (npub = current_setting('app.npub', true));

-- Create a function to set the current user's npub
CREATE OR REPLACE FUNCTION set_user_npub(user_npub TEXT)
RETURNS VOID AS $$
BEGIN
    PERFORM set_config('app.npub', user_npub, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION set_user_npub(TEXT) TO anon, authenticated; 