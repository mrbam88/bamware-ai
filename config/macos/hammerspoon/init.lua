-- volume-guard: the Mac's built-in speakers must never blast when macOS falls
-- back to them (AirPods auto-switch to the iPhone, Bluetooth drop, unplug).
-- Headphones and other external outputs are never touched.
-- Canonical copy: bamware-ai config/macos/hammerspoon/init.lua
-- Log: ~/Library/Logs/volume-guard.log
require("hs.ipc")
hs.autoLaunch(true)
hs.menuIcon(true)

local LOG = os.getenv("HOME") .. "/Library/Logs/volume-guard.log"
local function log(msg)
  local f = io.open(LOG, "a")
  if f then f:write(os.date("%Y-%m-%d %H:%M:%S ") .. msg .. "\n"); f:close() end
end

local function snapshot()
  local def = hs.audiodevice.defaultOutputDevice()
  local parts = {}
  for _, d in ipairs(hs.audiodevice.allOutputDevices()) do
    local v = d:outputVolume()
    parts[#parts + 1] = string.format("%s%s=%s",
      (def and d:uid() == def:uid()) and "*" or "", d:name(), v and math.floor(v) or "n/a")
  end
  return table.concat(parts, ", ")
end

local function isSpeakers(d)
  return d:transportType() == "Built-in"
end

local function zeroDefault(reason)
  local dev = hs.audiodevice.defaultOutputDevice()
  if not dev or not isSpeakers(dev) then return end
  local before = dev:outputVolume()
  if before and before > 0 then
    dev:setOutputVolume(0)
    log(string.format("zero(%s): %s %d -> 0", reason, dev:name(), before))
  end
end

-- Layer 1: while something else is the output, the built-in speakers stay
-- parked at 0, so they are already silent at the moment macOS falls back.
local function parkInactive()
  local def = hs.audiodevice.defaultOutputDevice()
  for _, d in ipairs(hs.audiodevice.allOutputDevices()) do
    if isSpeakers(d) and (not def or d:uid() ~= def:uid()) then
      local v = d:outputVolume()
      if v and v > 0 then
        d:setOutputVolume(0)
        log(string.format("park: %s %d -> 0", d:name(), v))
      end
    end
  end
end

-- Layer 2: on any output change, zero the new default now and again over the
-- next second, because macOS re-applies the device's remembered level late.
local lastDef = "none"
local function onSwitch(reason)
  local def = hs.audiodevice.defaultOutputDevice()
  lastDef = def and def:uid() or "none"   -- so the poll does not fire again for this switch
  log("event " .. reason .. " [" .. snapshot() .. "]")
  zeroDefault(reason)
  parkInactive()
  for _, t in ipairs({0.3, 1.0}) do
    hs.timer.doAfter(t, function() zeroDefault(reason .. "+" .. t); parkInactive() end)
  end
end

hs.audiodevice.watcher.setCallback(function(event)
  local e = event:gsub("%s+$", "")   -- macOS 27 sends "dOut", older builds "dOut "
  if e == "dOut" or e == "dev#" then onSwitch(e) end
end)
hs.audiodevice.watcher.start()

-- Layer 3: wake / unlock, for Bluetooth that dropped while the lid was closed.
VolumeGuardSleep = hs.caffeinate.watcher.new(function(ev)
  local w = hs.caffeinate.watcher
  if ev == w.systemDidWake or ev == w.screensDidWake or ev == w.screensDidUnlock then
    onSwitch("wake")
  end
end):start()

-- Layer 4: 2 s poll, in case an event is ever missed.
VolumeGuardPoll = hs.timer.doEvery(2, function()
  local def = hs.audiodevice.defaultOutputDevice()
  local uid = def and def:uid() or "none"
  if uid ~= lastDef then lastDef = uid; onSwitch("poll") end
  parkInactive()
end)

onSwitch("startup")
