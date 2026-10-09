-- Zero the output volume whenever macOS switches the default output device
-- (headphones unplugged, Bluetooth dropped/reconnected). Turn it up by hand after.
-- Canonical copy: bamware-ai config/macos/hammerspoon/init.lua
require("hs.ipc")
hs.autoLaunch(true)
hs.menuIcon(true)

local lastOut = hs.audiodevice.defaultOutputDevice():uid()

local function zeroVolume()
  local dev = hs.audiodevice.defaultOutputDevice()
  if not dev then return end
  dev:setOutputVolume(0)
  dev:setOutputMuted(false)   -- volume 0, not muted; just slide it up
  print(os.date("%Y-%m-%dT%H:%M:%S") .. " output -> " .. dev:name() .. " volume=0")
end

hs.audiodevice.watcher.setCallback(function(event)
  -- macOS 27 delivers "dOut" (older builds: "dOut " with a trailing space)
  if event:gsub("%s+$", "") ~= "dOut" then return end
  local dev = hs.audiodevice.defaultOutputDevice()
  if not dev or dev:uid() == lastOut then return end
  lastOut = dev:uid()
  hs.timer.doAfter(0.3, zeroVolume)
  hs.timer.doAfter(1.3, zeroVolume) -- again in case the device re-applied its remembered level
end)
hs.audiodevice.watcher.start()
