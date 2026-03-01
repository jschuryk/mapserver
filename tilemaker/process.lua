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

  -- Roads and paths
  if highway ~= "" then
    -- Normalize link roads and paths to their parent class
    local class = highway
    if highway == "motorway_link"                then class = "motorway"   end
    if highway == "trunk_link"                   then class = "trunk"      end
    if highway == "primary_link"                 then class = "primary"    end
    if highway == "secondary_link"               then class = "secondary"  end
    if highway == "tertiary_link"                then class = "tertiary"   end
    if highway == "unclassified" or
       highway == "residential"                  then class = "minor"      end
    if highway == "path"     or highway == "footway"   or
       highway == "cycleway" or highway == "steps"     or
       highway == "bridleway"                    then class = "path"       end

    Layer("transportation", false)
    Attribute("class", class)

    if name ~= "" then
      Layer("transportation_name", false)
      Attribute("class", class)
      Attribute("name:latin", name)
    end
    return
  end

  -- Waterways (rivers, canals, streams — linear)
  if waterway == "river"  or waterway == "canal" or
     waterway == "stream" or waterway == "drain" then
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
