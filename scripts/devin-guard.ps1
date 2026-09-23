# Devin CLI PreToolUse guard.
# Reads the hook event JSON from stdin and blocks destructive commands.
# Output: exit 0 = allow; exit 2 + JSON {"decision":"block"} = deny.

$ErrorActionPreference = 'SilentlyContinue'
$raw = [Console]::In.ReadToEnd()
if (-not $raw) { exit 0 }
try { $evt = $raw | ConvertFrom-Json } catch { exit 0 }
$cmd = [string]$evt.tool_input.command
if (-not $cmd) { exit 0 }

$blocked = @(
    @{ re = '(?i)\brm\s+-[a-z]*[rf]';                     msg = 'rm -rf/-fr' },
    @{ re = '(?i)\bRemove-Item\b[^|;]*-Recurse';           msg = 'Remove-Item -Recurse' },
    @{ re = '(?i)\b(rd|rmdir)\s+/s\b';                     msg = 'rd /s' },
    @{ re = '(?i)\bdel\s+/[fsq]';                          msg = 'del /f|/s|/q' },
    @{ re = '(?i)\bgit\s+reset\s+--hard\b';                msg = 'git reset --hard' },
    @{ re = '(?i)\bgit\s+clean\b';                         msg = 'git clean' },
    @{ re = '(?i)\bgit\s+push\b[^|;]*(--force\b|\s-f\b)';  msg = 'git push --force' },
    @{ re = '(?i)\bgit\s+checkout\s+(--|\.)';              msg = 'git checkout --' },
    @{ re = '(?i)\bgit\s+restore\b[^|;]*--worktree';       msg = 'git restore --worktree' },
    @{ re = '(?i)\bgit\s+branch\s+-D\b';                   msg = 'git branch -D' },
    @{ re = '(?i)\bsudo\s+update\b|/usr/local/bin/update\b'; msg = 'production deploy (update)' },
    @{ re = '(?i)\b(bash|sh)\s+[^|;]*deploy/update\.sh';   msg = 'scripts/deploy/update.sh' },
    @{ re = '(?i)\bDROP\s+(TABLE|DATABASE|SCHEMA)\b|\bTRUNCATE\s+TABLE\b'; msg = 'destructive SQL' },
    @{ re = '(?i)\bmkfs\b|\bformat\s+[a-z]:';              msg = 'disk format' }
)

foreach ($b in $blocked) {
    if ($cmd -match $b.re) {
        $out = @{
            decision = 'block'
            reason   = "devin-guard: blocked '$($b.msg)'. Run it manually outside Devin if really needed."
        }
        $out | ConvertTo-Json -Compress
        exit 2
    }
}
exit 0
