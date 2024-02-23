
# █▀▀ █▀█ █▄░█ █▀▀ █ █▀▀ █░█ █▀█ ▄▀█ ▀█▀ █ █▀█ █▄░█
# █▄▄ █▄█ █░▀█ █▀░ █ █▄█ █▄█ █▀▄ █▀█ ░█░ █ █▄█ █░▀█

# Replaces /etc/nixos/configuration.nix

# A .nix file is just a big Nix expression (I think)
# This .nix file is a function that takes an attribute set as an input

{ inputs, lib, config, pkgs, ... }: {

  # BASIC SYSTEM CONFIGURATION --------------------

  imports = [
    ./hardware-configuration.nix
  ];

  # Configure nixpkgs instance
  nixpkgs = {
    config = {
      allowUnfree = false;
    };
  };

  nix.settings = {
    experimental-features = "nix-command flakes";

    # Deduplicate and optimize nix store
    auto-optimise-store = true;
  };

  # Networking
  networking = {
    hostName = "astarion";
    networkmanager.enable = true;
  };

  # Audio
  hardware.pulseaudio.enable = true;
  sound.enable = true;
  
  # Battery management
  services.upower.enable = true;

  # Bootloader
  boot.loader.systemd-boot.enable = true;
  
  # https://nixos.wiki/wiki/FAQ/When_do_I_update_stateVersion
  system.stateVersion = "23.05";

  # SYSTEM PACKAGES ----------------------------

  # Minimal system requirements - installed for all users
  environment.systemPackages = with pkgs; [
    vim
    chromium
    brightnessctl
    kitty
  ];

  # The difference between including something in systemPackages above
  # and doing `programs.something.enable = true` below is just that the
  # method below lets you specify more config options. The top method
  # only installs the package.

  programs.git.enable = true;

  programs.zsh.enable = true;

  programs.hyprland.enable = true;

  # USER CONFIGURATION ---------------------------

  users = {
    defaultUserShell = pkgs.zsh;
    users = {
      alexis = {
        initialPassword = "password";
        isNormalUser = true;
        extraGroups = ["wheel" "networkmanager" "audio"];
      };
    };
  };
}