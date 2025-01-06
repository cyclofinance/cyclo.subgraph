{
  description = "Rainix flake with only subgraph tasks";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs";
    flake-utils.url = "github:numtide/flake-utils";
    foundry.url = "github:shazow/foundry.nix";
    rainix.url = "github:rainprotocol/rainix";
  };

  outputs = { self, rainix, nixpkgs, flake-utils, foundry, ... }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = rainix.pkgs.${system};

        the-graph = pkgs.stdenv.mkDerivation rec {
          pname = "the-graph";
          version = "0.69.2";
          src = let
            release-name = "%40graphprotocol%2Fgraph-cli%400.69.2";
            system-mapping = {
              x86_64-linux = "linux-x64";
              x86_64-darwin = "darwin-x64";
              aarch64-darwin = "darwin-arm64";
            };
            system-sha = {
              x86_64-linux = "sha256:07grrdrx8w3m8sqwdmf9z9zymwnnzxckgnnjzfndk03a8r2d826m";
              x86_64-darwin = "sha256:0j4p2bkx6pflkif6xkvfy4vj1v183mkg59p2kf3rk48wqfclids8";
              aarch64-darwin = "sha256:0pq0g0fq1myp0s58lswhcab6ccszpi5sx6l3y9a18ai0c6yzxim0";
            };
          in
          builtins.fetchTarball {
            url = "https://github.com/graphprotocol/graph-tooling/releases/download/${release-name}/graph-${system-mapping.${system}}.tar.gz";
            sha256 = system-sha.${system};
          };
          buildInputs = [];
          installPhase = ''
            mkdir -p $out
            cp -r $src/* $out
          '';
        };

        mkTask = { name, body, additionalBuildInputs ? [] }: pkgs.symlinkJoin {
          name = name;
          paths = [
            ((pkgs.writeScriptBin name body).overrideAttrs(old: {
              buildCommand = "${old.buildCommand}\n patchShebangs $out";
            }))
          ] ++ additionalBuildInputs;
          buildInputs = [ pkgs.makeWrapper ] ++ additionalBuildInputs;
          postBuild = "wrapProgram $out/bin/${name} --prefix PATH : $out/bin";
        };

        # Define tasks
        subgraph-run-build = mkTask {
          name = "subgraph-run-build";
          body = ''
            set -euxo pipefail
            forge build
            ${the-graph}/bin/graph codegen;
            ${the-graph}/bin/graph build;
            cd -;
          '';
        };

        subgraph-run-test = mkTask {
        name = "subgraph-run-test";
        body = ''
            set -euxo pipefail
            docker compose up --abort-on-container-exit
        '';
        };

        # Package list for devShell
        subgraph-tasks = [
          subgraph-run-build
          subgraph-run-test
        ];

      in {
        devShells.default = pkgs.mkShell {
          buildInputs = subgraph-tasks ++ [ the-graph ];
          shellHook = ''
            echo "Development shell loaded. Available tasks:"
            echo "  - subgraph-run-build"
            echo "  - subgraph-run-test"
          '';
        };
      }
    );
}
