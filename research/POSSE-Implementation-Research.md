# POSSE Implementation Research

**Research Date**: December 2025
**Purpose**: Inform PRD-7 (POSSE - Single Source of Truth Publishing) implementation decisions
**Status**: Complete

---

## Executive Summary

This research confirms that Micro.blog supports both native fediverse (ActivityPub) federation AND cross-posting to multiple platforms. The key findings are:

1. **Fediverse Handle**: Micro.blog supports custom domain fediverse handles in the format `@username@yourdomain.com`
2. **Bluesky Domain**: Bluesky supports `@yourdomain.com` handles via DNS TXT record verification
3. **Cross-posting**: Micro.blog supports 9 platforms including Bluesky, LinkedIn, Flickr, and more
4. **Critical Caveat**: Changing fediverse handles on Micro.blog "deletes" your profile from Mastodon servers - followers must re-follow

---

## 1. Micro.blog Native Fediverse (ActivityPub)

### How It Works

Micro.blog has built-in ActivityPub support, making your blog appear as a single-user Mastodon instance to other fediverse servers. This is **native federation**, not cross-posting - your content appears directly in fediverse timelines without being copied.

### Fediverse Handle Format

| Scenario | Handle Format | Example |
|----------|--------------|---------|
| Default (no custom domain) | `@username@micro.blog` | `@wiggitywhitney@micro.blog` |
| With custom domain | `@username@yourdomain.com` | `@whitney@whitneylee.com` |
| Custom domain (flexible username) | `@anyname@yourdomain.com` | `@me@whitneylee.com` |

**Key Point**: When using your custom domain, you can choose any username (e.g., `@me@`, `@whitney@`). When using `@micro.blog`, the username must match your Micro.blog account name.

### Configuration Steps

1. Go to **Account** on Micro.blog web
2. Scroll to **ActivityPub** section
3. Pick your username at your custom domain
4. Mastodon users can then follow `@yourname@yourdomain.com`

### Fediverse Settings (February 2025 Update)

Micro.blog added new federation controls under **Account → View Fediverse Details**:

| Setting | Behavior |
|---------|----------|
| **Send all posts** (default) | All posts federate to Mastodon/fediverse |
| **Send only replies** | Posts don't appear in fediverse timelines, only replies |
| **Mute entire fediverse** | Fediverse replies still arrive but don't appear in your Micro.blog timeline |

**Source**: [Manton Reece - New fediverse settings in Micro.blog](https://www.manton.org/2025/02/12/new-fediverse-settings-in-microblog.html)

### Mastodon Account Migration (FROM Mastodon TO Micro.blog)

**GOOD NEWS**: Micro.blog supports incoming Mastodon account migrations! If you have an existing Mastodon account (like Hachyderm), you can migrate followers to a new Micro.blog fediverse identity.

**What transfers:**
- ✅ Followers (automatically redirected via Mastodon's Move feature)
- ✅ People you follow (via CSV export/import)

**What does NOT transfer:**
- ❌ Posts (stay on old server)
- ❌ Likes, boosts, replies
- ❌ DMs

**Source**: [How I migrated my Mastodon account to micro.blog](https://msicc.net/migrating-my-mastodon-account-micro-blog/)

### Migration Process (Hachyderm → Micro.blog Fediverse)

1. **On Micro.blog**: Create fediverse identity (Account → View Fediverse Details)
   - Set username at your custom domain (e.g., `@whitney@whitneylee.com`)

2. **On Micro.blog**: Add alias for old account
   - Account → View Fediverse Details → Aliases → Add Alias
   - Enter: `@wiggitywhitney@hachyderm.io`

3. **Export from Hachyderm**:
   - Preferences → Import and Export → Data Export
   - Download `following.csv`

4. **Import to Micro.blog**:
   - Account → View Fediverse Details → Import Follows
   - Upload the CSV

5. **Trigger migration on Hachyderm**:
   - Preferences → Account → Move to a different account
   - Enter new handle (e.g., `@whitney@whitneylee.com`)
   - Followers automatically redirected

6. **Disable Mastodon cross-posting** in Micro.blog (now using native federation)

**Timeline**: Most followers migrate instantly, some may take hours or days.

**30-day cooldown**: Once you migrate, you can't migrate again for 30 days.

### Micro.blog Handle Changes (Different Scenario)

**Note**: The warning about "deleting your profile" applies specifically to changing your Micro.blog fediverse username AFTER you already have one set up - NOT to incoming Mastodon migrations.

**Source**: [Confused over Custom Domain and Fediverse address](https://help.micro.blog/t/confused-over-custom-domain-and-fediverse-address/2941)

### Current Situation for Whitney (December 2025)

**Actual setup**:
- Hachyderm account: `@wiggitywhitney@hachyderm.io` (274 followers)
- NO Micro.blog native fediverse identity currently
- Micro.blog cross-posts TO Hachyderm (copying posts)

**Migration path**:
1. Create Micro.blog fediverse identity (`@whitney@whitneylee.com` or similar)
2. Use Mastodon's official migration to move 274 followers from Hachyderm
3. Disable Mastodon cross-posting (use native federation instead)
4. Posts stay on Hachyderm (archived), new posts go to whitneylee.com

---

## 2. Bluesky Custom Domain Handle

### How It Works

Bluesky uses DNS verification to prove domain ownership. Your domain becomes your handle (e.g., `@whitneylee.com`), providing verified identity without platform-specific verification badges.

### DNS Verification Process

1. In Bluesky app: **Settings → Account → Handle → Change Handle**
2. Select **"I have my own domain"**
3. Add DNS TXT record:
   - **Host/Name**: `_atproto`
   - **Type**: TXT
   - **Value**: `did=did:plc:[your-unique-value]` (Bluesky provides this)
4. Wait for DNS propagation (usually minutes, up to 24 hours)
5. Click **"Verify DNS Record"** in Bluesky

### What Happens to Followers

- **Followers preserved**: Existing followers automatically see your new handle
- **Old handle reserved**: As of December 2024, your old `.bsky.social` handle is reserved when you switch to a custom domain
- **Mentions/tags still work**: Old mentions continue pointing to your account

### Subdomain Option

For organizations or multiple identities, you can use subdomains:
- `@me.whitneylee.com` - DNS record would be `_atproto.me`
- Useful if you want different identities for different purposes

**Source**: [How to verify your Bluesky account](https://bsky.social/about/blog/4-28-2023-domain-handle-tutorial)

### Status for Whitney

**✅ COMPLETE** - Bluesky handle already changed to `@whitneylee.com`
- Profile: https://bsky.app/profile/whitneylee.com
- Followers preserved
- Cross-posting from Micro.blog continues working

---

## 3. Micro.blog Cross-Posting Capabilities

### Supported Platforms (December 2025)

| Platform | Status | Notes |
|----------|--------|-------|
| **Mastodon** | Supported | Can use cross-posting OR native federation (not both) |
| **Bluesky** | Supported | Cross-posts automatically, includes photos |
| **LinkedIn** | Supported | Available via Sources |
| **Flickr** | Supported | Photo cross-posting |
| **Threads** | Supported | Meta's ActivityPub platform |
| **Medium** | Supported | Long-form content |
| **Tumblr** | Supported | Posts and photos |
| **Nostr** | Supported | Decentralized protocol |
| **Pixelfed** | Supported | Photo-focused fediverse |
| Twitter/X | **Discontinued** | API changes in 2023 ended support |

**Source**: [Automatic cross-posting to Mastodon and other services](https://help.micro.blog/t/automatic-cross-posting-to-mastodon-and-other-services/860)

### Configuration

1. Go to **Sources** in Micro.blog sidebar
2. Click **"Add [Platform]"** for each service
3. Authorize your account on that platform
4. Cross-posting begins automatically

### Cross-Posting Behavior

| Content Type | Behavior |
|--------------|----------|
| Short posts (<500 chars, no title) | Copied in full |
| Long posts (>500 chars) | Truncated with link back to blog |
| Posts with titles | Title + link only |
| Photos | Up to 4 photos attached (min 200×200px) |
| Replies | NOT cross-posted (only direct posts) |

### Native Federation vs. Cross-Posting (Mastodon)

| Feature | Native Federation | Cross-Posting |
|---------|-------------------|---------------|
| How it works | ActivityPub (federated) | Copy posted to Mastodon |
| Replies | Come back to Micro.blog | Separate on each platform |
| Identity | `@user@yourdomain.com` | Your Mastodon account |
| Use case | Single identity | Maintain separate Mastodon account |

**Important**: You should use ONE or the OTHER for Mastodon, not both (to avoid duplicate posts).

---

## 4. Micro.blog + Bluesky Integration Details

### Cross-Posting Setup

1. Go to **Sources → Add Bluesky**
2. Authorize your Bluesky account
3. Posts automatically copy to Bluesky with photos
4. Individual posts can be excluded from cross-posting

### Using Your Domain as Bluesky Handle via Micro.blog

Micro.blog can help configure your blog's domain as your Bluesky handle:
1. In Bluesky: **Settings → Change Handle → "I have my own domain"**
2. Enter your blog's domain (e.g., `whitneylee.com`)
3. Select **"No DNS Panel"** if Micro.blog is hosting your domain
4. Micro.blog may handle verification automatically

### Reply Integration

- Micro.blog checks for Bluesky replies to your cross-posted content
- Replies appear in your Micro.blog timeline
- You can respond from Micro.blog and it syncs back to Bluesky

**Source**: [Micro.blog and Bluesky](https://help.micro.blog/t/micro-blog-and-bluesky/3273)

---

## 5. Implementation Recommendations

### For PRD-7 POSSE Implementation

Based on this research, here are specific recommendations:

#### Bluesky ✅ COMPLETE
1. **Bluesky handle changed to `@whitneylee.com`**
   - Profile: https://bsky.app/profile/whitneylee.com
   - Followers preserved
   - Cross-posting from Micro.blog continues working

#### Fediverse/Mastodon (Moderate Risk - Migration Available!)
2. **Current situation**:
   - Hachyderm account: `@wiggitywhitney@hachyderm.io` (274 followers)
   - Micro.blog cross-posts TO Hachyderm currently
   - Mastodon's official migration feature CAN transfer followers

3. **Migration process** (if proceeding):
   - Create Micro.blog fediverse identity (e.g., `@whitney@whitneylee.com`)
   - Set up alias on Micro.blog pointing to Hachyderm account
   - Export follows from Hachyderm, import to Micro.blog
   - Trigger migration on Hachyderm → followers auto-redirect
   - Disable Mastodon cross-posting (use native federation instead)
   - Posts stay on Hachyderm (archived), new content on whitneylee.com

4. **What you keep vs lose**:
   - ✅ KEEP: 274 followers (migrated automatically)
   - ✅ KEEP: People you follow (via CSV export/import)
   - ❌ LOSE: Hachyderm posts (stay on Hachyderm, archived)
   - ❌ LOSE: Likes, boosts, replies, DMs

#### Cross-Posting Configuration
5. **Current cross-posting status** (as of December 2025):
   - ✅ Bluesky: Active (`@whitneylee.com`)
   - ✅ Flickr: Already enabled
   - ✅ Medium: Enabled (all posts, to keep existing content fresh)
   - ⚠️ Mastodon/Hachyderm: Currently enabled (to be disabled after fediverse migration)
   - ❌ LinkedIn: Images don't cross-post (planned feature, not implemented)

**Platform-Specific Limitations**:
- **Medium**: Cross-posting settings are global. All posts go to Medium (including short ones).
- **LinkedIn**: Images do NOT cross-post currently. Manton says feature is planned but not yet implemented (as of March 2025).
- **Category-based filtering**: Does not work reliably. Cross-posting settings are global, not per-category.

#### Historical Content
5. **Keep historical content local-only**
   - Already imported with cross-posting disabled (PRD-6)
   - Don't retroactively federate old content (timeline spam risk)

---

## 6. Open Questions for User Decision

Before implementation, Whitney should decide:

1. **Proceed with Hachyderm migration?**
   - Current: `@wiggitywhitney@hachyderm.io` (274 followers)
   - Proposed: `@[username]@whitneylee.com` (domain-based identity)
   - Trade-off: Lose old posts, keep followers

2. **Fediverse username format** (if migrating):
   - `@whitney@whitneylee.com`
   - `@me@whitneylee.com`
   - `@wiggitywhitney@whitneylee.com`

3. **Hachyderm account after migration**:
   - Mastodon migration locks old account (still visible but redirects)
   - Posts remain archived and viewable
   - No action needed - it becomes a redirect

4. **Additional cross-posting**:
   - Flickr: ✅ Already enabled
   - Medium: ✅ Enabled (user enabled in Micro.blog UI - all posts to keep content fresh)
   - LinkedIn: ❌ Skip for now (images don't cross-post, planned but not implemented)

---

## Sources

### Primary Sources
- [Manton Reece - New fediverse settings in Micro.blog](https://www.manton.org/2025/02/12/new-fediverse-settings-in-microblog.html)
- [Micro.blog Help - Automatic cross-posting](https://help.micro.blog/t/automatic-cross-posting-to-mastodon-and-other-services/860)
- [Micro.blog Help - Custom Domain and Fediverse](https://help.micro.blog/t/confused-over-custom-domain-and-fediverse-address/2941)
- [Micro.blog Help - Fediverse username](https://help.micro.blog/t/fediverse-username/3282)
- [Micro.blog Help - Micro.blog and Bluesky](https://help.micro.blog/t/micro-blog-and-bluesky/3273)
- [Bluesky - Domain Handle Tutorial](https://bsky.social/about/blog/4-28-2023-domain-handle-tutorial)

### Mastodon Migration Sources
- [How I migrated my Mastodon account to micro.blog](https://msicc.net/migrating-my-mastodon-account-micro-blog/)
- [Moving or leaving accounts - Mastodon documentation](https://docs.joinmastodon.org/user/moving/)
- [Transferring your Mastodon account to another server - Fedi.Tips](https://fedi.tips/transferring-your-mastodon-account-to-another-server/)
- [How to migrate from one server to another - Mastodon Blog](https://blog.joinmastodon.org/2019/06/how-to-migrate-from-one-server-to-another/)

### Cross-Posting Limitations Sources
- [Different crossposting per category](https://help.micro.blog/t/different-crossposting-per-category/3744)
- [How to include images when crossposting to LinkedIn?](https://help.micro.blog/t/how-to-include-images-when-crossposting-to-linkedin/3039)
- [Selecting cross-posting options for individual posts](https://help.micro.blog/t/selecting-cross-posting-options-for-individual-posts/1458)

### Secondary Sources
- [How to change custom domain name for fediverse](https://help.micro.blog/t/how-do-i-change-my-custom-domain-name-for-the-fediverse/2807)
- [Bluesky cross-posting and mentions](https://help.micro.blog/t/bluesky-cross-posting-and-mentions/1702)
- [WordPress.com - Bluesky Handle Setup](https://wordpress.com/blog/2025/01/28/wordpress-com-domain-bluesky-handle/)
- [EasyDNS - Bluesky Custom Domain Setup](https://easydns.com/blog/2024/12/03/set-your-bluesky-handle-to-your-own-domain-name-using-dns/)

---

*This research document supports PRD-7 implementation decisions. Last updated December 2025.*
