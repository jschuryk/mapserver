-- Tilemaker processing script (tilemaker 3.x API)
-- Layer names match tilemaker/config.json (OpenMapTiles-compatible schema).
--
-- Key API difference from 2.x:
--   node_keys must be a global TABLE, not a function.
--   way_keys is not used in 3.x (all ways are processed by default).

node_keys = { "place", "name", "amenity", "shop", "tourism" }

-- NOTE: Admin boundary relations are disabled due to high memory usage at basezoom=10.
-- Provincial/country boundaries are instead served from public/data/provinces.geojson.
-- To re-enable, uncomment the functions below and add "boundary" back to config.json.
--[[
function relation_scan_function(relation)
  return Find("boundary") == "administrative" and
    (Find("admin_level") == "4" or Find("admin_level") == "2")
end

function relation_function(relation)
  local admin_level = Find("admin_level")
  if Find("boundary") == "administrative" and
      (admin_level == "4" or admin_level == "2") then
    Layer("boundary", false)
    Attribute("admin_level", tonumber(admin_level))
    local name = Find("name")
    if name ~= "" then Attribute("name:latin", name) end
  end
end
--]]

function node_function(node)
  local place   = Find("place")
  local name    = Find("name")
  local amenity = Find("amenity")
  local shop    = Find("shop")
  local tourism = Find("tourism")

  -- Named settlements (cities, towns, villages)
  if place ~= "" and name ~= "" then
    Layer("place")
    Attribute("class", place)
    Attribute("name:latin", name)
  end

  -- Points of interest
  if amenity ~= "" or shop ~= "" or tourism ~= "" then
    Layer("poi")
    if     amenity ~= "" then Attribute("class", amenity)
    elseif shop    ~= "" then Attribute("class", shop)
    else                       Attribute("class", tourism) end
    if name ~= "" then Attribute("name:latin", name) end
  end
end

function way_function()
  local highway  = Find("highway")
  local waterway = Find("waterway")
  local natural  = Find("natural")
  local name     = Find("name")

  -- Roads — only major roads (motorway, trunk, primary)
  if highway ~= "" then
    local class = highway
    if highway == "motorway_link" then class = "motorway" end
    if highway == "trunk_link"    then class = "trunk"    end
    if highway == "primary_link"  then class = "primary"  end

    -- Skip everything below primary
    if class ~= "motorway" and class ~= "trunk" and class ~= "primary" then
      return
    end

    Layer("transportation", false)
    Attribute("class", class)

    if name ~= "" then
      Layer("transportation_name", false)
      Attribute("class", class)
      Attribute("name:latin", name)
    end
    return
  end

  -- Waterways — named rivers and canals only (unnamed minor waterways omitted)
  if (waterway == "river" or waterway == "canal") and name ~= "" then
    Layer("waterway", false)
    Attribute("class", waterway)
  end

  -- Water bodies
  if natural == "water" or natural == "coastline" then
    Layer("water", true)
    Attribute("class", "lake")
  end

  -- Buildings omitted (layer removed from config; not meaningful at zoom <= 10)
end
